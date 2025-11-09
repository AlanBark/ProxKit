import { PDFDocument, rgb } from "pdf-lib";
import type { CardImage } from "../types/card";

import {
    PDFWorkerMessageType,
    type GeneratePDFRequest,
    type PDFWorkerMessage,
} from "../utils/pdf/workerTypes";

// Import registration background images
import registrationA4 from "../assets/a4_registration.jpg";
import registrationLetter from "../assets/letter_registration.jpg";

/**
 * PDF Worker - Handles PDF generation in background thread
 */

/**
 * Bleed edge margin (in mm)
 * - If bleed is > 0: crop (bleed - BLEED_EDGE_MARGIN) from each side
 * - If bleed is 0: add BLEED_EDGE_MARGIN as an edge
 *
 * Example: If bleed is 3mm and BLEED_EDGE_MARGIN is 1mm, crop 2mm from each side
 */
const BLEED_EDGE_MARGIN = 0.5;

/**
 * Corner radius for cut file rounded corners (in mm)
 */
const CUT_CORNER_RADIUS = 2.5;

let currentRequestId: string | null = null;
let isCancelled = false;

/**
 * Convert millimeters to PDF points (1 point = 1/72 inch)
 */
function mmToPoints(mm: number): number {
    return (mm / 25.4) * 72;
}

/**
 * Generate DXF header section with page dimensions
 * pageWidthMm and pageHeightMm are in mm, will be converted to inches for DXF
 */
function generateDXFHeader(pageWidthMm: number, pageHeightMm: number): string {
    // Convert page dimensions to inches (DXF units)
    const pageWidthInches = mmToInches(pageWidthMm);
    const pageHeightInches = mmToInches(pageHeightMm);

    return `0
SECTION
2
HEADER
9
$ACADVER
1
AC1015
9
$INSUNITS
70
1
9
$LIMMIN
10
0.0
20
0.0
9
$LIMMAX
10
${pageWidthInches.toFixed(6)}
20
${pageHeightInches.toFixed(6)}
9
$EXTMIN
10
0.0
20
0.0
30
0.0
9
$EXTMAX
10
${pageWidthInches.toFixed(6)}
20
${pageHeightInches.toFixed(6)}
30
0.0
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LTYPE
70
1
0
LTYPE
2
CONTINUOUS
70
0
3
Solid line
72
65
73
0
40
0.0
0
ENDTAB
0
TABLE
2
LAYER
70
1
0
LAYER
2
CUT
70
0
62
7
6
CONTINUOUS
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
`;
}

/**
 * Generate DXF footer section
 */
function generateDXFFooter(): string {
    return `0
ENDSEC
0
EOF
`;
}

/**
 * Convert millimeters to inches (for DXF - Silhouette Studio interprets DXF units as inches)
 */
function mmToInches(mm: number): number {
    return mm / 25.4;
}

/**
 * Generate a rounded rectangle path in DXF format
 * Input coordinates are in mm, but will be converted to inches for DXF output
 * Silhouette Studio interprets DXF units as inches
 */
function generateRoundedRectangleDXF(
    xMm: number,
    yMm: number,
    widthMm: number,
    heightMm: number,
    radiusMm: number
): string {
    let dxf = "";

    // Convert all measurements from mm to inches
    const x = mmToInches(xMm);
    const y = mmToInches(yMm);
    const width = mmToInches(widthMm);
    const height = mmToInches(heightMm);
    const radius = mmToInches(radiusMm);

    // Ensure radius doesn't exceed half of smallest dimension
    const maxRadius = Math.min(width, height) / 2;
    const r = Math.min(radius, maxRadius);

    // Calculate corner centers
    const corners = [
        { cx: x + r, cy: y + r },                    // Bottom-left
        { cx: x + width - r, cy: y + r },            // Bottom-right
        { cx: x + width - r, cy: y + height - r },   // Top-right
        { cx: x + r, cy: y + height - r },           // Top-left
    ];

    // Draw lines connecting the arcs
    // Bottom line
    dxf += generateDXFLine(x + r, y, x + width - r, y);

    // Bottom-right arc
    dxf += generateDXFArc(corners[1].cx, corners[1].cy, r, 270, 0);

    // Right line
    dxf += generateDXFLine(x + width, y + r, x + width, y + height - r);

    // Top-right arc
    dxf += generateDXFArc(corners[2].cx, corners[2].cy, r, 0, 90);

    // Top line
    dxf += generateDXFLine(x + width - r, y + height, x + r, y + height);

    // Top-left arc
    dxf += generateDXFArc(corners[3].cx, corners[3].cy, r, 90, 180);

    // Left line
    dxf += generateDXFLine(x, y + height - r, x, y + r);

    // Bottom-left arc
    dxf += generateDXFArc(corners[0].cx, corners[0].cy, r, 180, 270);

    return dxf;
}

/**
 * Generate DXF LINE entity
 */
function generateDXFLine(x1: number, y1: number, x2: number, y2: number): string {
    return `0
LINE
8
CUT
10
${x1.toFixed(6)}
20
${y1.toFixed(6)}
30
0.0
11
${x2.toFixed(6)}
21
${y2.toFixed(6)}
31
0.0
`;
}

/**
 * Generate DXF ARC entity
 * Angles in degrees, counterclockwise from positive X-axis
 */
function generateDXFArc(
    cx: number,
    cy: number,
    radius: number,
    startAngle: number,
    endAngle: number
): string {
    return `0
ARC
8
CUT
10
${cx.toFixed(6)}
20
${cy.toFixed(6)}
30
0.0
40
${radius.toFixed(6)}
50
${startAngle.toFixed(6)}
51
${endAngle.toFixed(6)}
`;
}

/**
 * Fetch image data from URL or blob
 */
async function fetchImageAsBytes(imageUrl: string): Promise<Uint8Array> {
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
}

/**
 * Calculate grid layout for 4x2 card arrangement
 */
function calculateGridLayout(
    pageWidth: number,
    pageHeight: number,
    cardWidth: number,
    cardHeight: number
): { x: number; y: number; cellWidth: number; cellHeight: number } {
    const cols = 4;
    const rows = 2;

    // Calculate total grid dimensions
    const totalGridWidth = cardWidth * cols;
    const totalGridHeight = cardHeight * rows;

    // Center the grid on the page
    const startX = (pageWidth - totalGridWidth) / 2;
    const startY = (pageHeight - totalGridHeight) / 2;

    return {
        x: startX,
        y: startY,
        cellWidth: cardWidth,
        cellHeight: cardHeight,
    };
}

/**
 * Determine which registration background to use based on page dimensions
 */
function getRegistrationBackground(pageSettings: { width: number; height: number }): string {
    // A4: 210mm x 297mm (portrait)
    // Letter: 215.9mm x 279.4mm (portrait)
    // Check the width to determine the page type
    return pageSettings.width === 210 ? registrationA4 : registrationLetter;
}

/**
 * Crop image canvas by removing bleed
 *
 * The input image includes bleed area. We need to crop it to get only the card area.
 *
 * Logic:
 * - If bleed > 0: crop (bleed - BLEED_EDGE_MARGIN) from each side
 * - If bleed = 0: add BLEED_EDGE_MARGIN as an edge (negative crop = expand)
 *
 * For example:
 * - Card dimensions (without bleed): 63mm x 88mm
 * - Bleed: 3mm on all sides
 * - BLEED_EDGE_MARGIN: 1mm
 * - Total image represents: (63 + 3*2) x (88 + 3*2) = 69mm x 94mm
 * - We crop 2mm (3mm - 1mm) from each side to get a 65mm x 90mm result
 *
 * @returns Object containing the cropped image bytes and actual dimensions in mm
 */
async function cropImageBleed(
    imageUrl: string,
    bleed: number,
    cardWidth: number,
    cardHeight: number
): Promise<{ imageBytes: Uint8Array; widthMm: number; heightMm: number }> {
    // Fetch the image
    const response = await fetch(imageUrl);
    const blob = await response.blob();

    // Create an image bitmap from the blob
    const imageBitmap = await createImageBitmap(blob);

    // Get image dimensions
    const imgWidth = imageBitmap.width;
    const imgHeight = imageBitmap.height;

    // The image represents the total card area including bleed
    const totalCardWidthMm = cardWidth + (bleed * 2);
    const totalCardHeightMm = cardHeight + (bleed * 2);

    // Calculate effective crop amount: bleed - BLEED_EDGE_MARGIN
    // If bleed is 0, this becomes negative, which means we'll expand the image
    const effectiveCrop = bleed - BLEED_EDGE_MARGIN;

    // Calculate crop percentage
    // For one side: effectiveCrop / totalCardDimension
    const cropPercentX = (effectiveCrop / totalCardWidthMm);
    const cropPercentY = (effectiveCrop / totalCardHeightMm);

    // Calculate how many pixels to crop from each side
    const cropLeftPx = Math.round(imgWidth * cropPercentX);
    const cropTopPx = Math.round(imgHeight * cropPercentY);

    // Resulting cropped dimensions (remove effectiveCrop from both sides)
    const croppedWidth = imgWidth - (cropLeftPx * 2);
    const croppedHeight = imgHeight - (cropTopPx * 2);

    // Create canvas with the final cropped size
    const canvas = new OffscreenCanvas(croppedWidth, croppedHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get canvas context');
    }

    // Handle both positive crop (remove pixels) and negative crop (add padding)
    if (cropLeftPx >= 0 && cropTopPx >= 0) {
        // Positive crop: crop from the source image
        ctx.drawImage(
            imageBitmap,
            cropLeftPx, cropTopPx, croppedWidth, croppedHeight,  // Source rectangle (what to take from source)
            0, 0, croppedWidth, croppedHeight                     // Destination rectangle (where to put it)
        );
    } else {
        // Negative crop: add padding around the image
        // When crop is negative, we need to draw the full source image centered on a larger canvas
        const padX = Math.abs(Math.min(0, cropLeftPx));
        const padY = Math.abs(Math.min(0, cropTopPx));

        ctx.drawImage(
            imageBitmap,
            0, 0, imgWidth, imgHeight,           // Take entire source image
            padX, padY, imgWidth, imgHeight      // Draw it centered on the canvas with padding
        );
    }

    // Convert canvas to PNG blob
    const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
    const arrayBuffer = await croppedBlob.arrayBuffer();

    // Calculate the actual dimensions of the cropped image in mm
    // Based on the pixel ratio: source image represents totalCardWidthMm x totalCardHeightMm
    const croppedWidthMm = (croppedWidth / imgWidth) * totalCardWidthMm;
    const croppedHeightMm = (croppedHeight / imgHeight) * totalCardHeightMm;

    return {
        imageBytes: new Uint8Array(arrayBuffer),
        widthMm: croppedWidthMm,
        heightMm: croppedHeightMm,
    };
}

/**
 * Generate PDF with progress reporting and cancellation support
 */
async function generatePDF(request: GeneratePDFRequest): Promise<void> {
    const { cards, pageSettings, cardWidth, cardHeight, requestId } = request.payload;

    currentRequestId = requestId;
    isCancelled = false;

    try {
        // Create new PDF document
        const pdfDoc = await PDFDocument.create();

        // Use landscape orientation (swap width and height)
        const pageWidthPt = mmToPoints(pageSettings.height);
        const pageHeightPt = mmToPoints(pageSettings.width);

        // Initialize DXF cut file with page dimensions (in landscape)
        // Note: DXF uses landscape dimensions (height x width)
        let dxfContent = generateDXFHeader(pageSettings.height, pageSettings.width);

        // Determine which registration background to use
        const registrationBg = getRegistrationBackground(pageSettings);

        // Fetch and embed the registration background
        const bgBytes = await fetchImageAsBytes(registrationBg);
        let bgImage = await pdfDoc.embedJpg(bgBytes);

        const cardsPerPage = 8;
        const totalPages = Math.ceil(cards.length / cardsPerPage);

        // Calculate grid layout for centered 4x2 arrangement
        // Use actual card dimensions including bleed margin for spacing
        const layout = calculateGridLayout(
            pageSettings.height,  // Landscape width in mm
            pageSettings.width,   // Landscape height in mm
            cardWidth + (2 * BLEED_EDGE_MARGIN),  // Actual width with margin
            cardHeight + (2 * BLEED_EDGE_MARGIN)  // Actual height with margin
        );

        // Process each page
        for (let pageNum = 0; pageNum < totalPages; pageNum++) {
            // Check for cancellation
            if (isCancelled || currentRequestId !== requestId) {
                return;
            }

            // Add landscape page
            const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);

            // Draw registration background to fill entire page
            page.drawImage(bgImage, {
                x: 0,
                y: 0,
                width: pageWidthPt,
                height: pageHeightPt,
            });

            // Get cards for this page
            const startIdx = pageNum * cardsPerPage;
            const endIdx = Math.min(startIdx + cardsPerPage, cards.length);
            const cardsOnPage = cards.slice(startIdx, endIdx);

            // Render each card in the 4x2 grid
            for (let i = 0; i < cardsOnPage.length; i++) {
                const card = cardsOnPage[i];

                // Skip null cards (blank placeholders)
                if (!card) continue;

                try {
                    // Calculate grid position (4 columns, 2 rows)
                    const col = i % 4;
                    const row = Math.floor(i / 4);

                    // Crop the image to remove bleed
                    const croppedImage = await cropImageBleed(
                        card.imageUrl,
                        card.bleed,
                        cardWidth,
                        cardHeight
                    );

                    // Embed the cropped image
                    const embeddedImage = await pdfDoc.embedPng(croppedImage.imageBytes);

                    // Calculate position in mm
                    // layout.cellWidth/cellHeight now include the bleed margin spacing
                    const cellX = layout.x + col * layout.cellWidth;
                    const cellY = layout.y + row * layout.cellHeight;

                    // Center the cropped image within its cell
                    // The cell is sized for the full margin, but the actual image might be slightly different due to rounding
                    const offsetX = cellX + (layout.cellWidth - croppedImage.widthMm) / 2;
                    const offsetY = cellY + (layout.cellHeight - croppedImage.heightMm) / 2;

                    // Convert to points (flip Y axis for PDF coordinate system)
                    const xPt = mmToPoints(offsetX);
                    const yPt = mmToPoints(pageSettings.width - offsetY - croppedImage.heightMm);  // Flip Y

                    // Use the actual cropped image dimensions to prevent warping
                    const widthPt = mmToPoints(croppedImage.widthMm);
                    const heightPt = mmToPoints(croppedImage.heightMm);

                    // Draw the cropped image
                    page.drawImage(embeddedImage, {
                        x: xPt,
                        y: yPt,
                        width: widthPt,
                        height: heightPt,
                    });

                    // Add cut path to DXF - center the cut line within the cell
                    const cardX = cellX + (layout.cellWidth - cardWidth) / 2;
                    const cardY = cellY + (layout.cellHeight - cardHeight) / 2;

                    // Debug: Output DXF offset for card 0 only (same offset applies to all cards in grid)
                    if (i === 0) {
                        const gridWidth = cardWidth * 4 + (BLEED_EDGE_MARGIN * 2);
                        const gridHeight = cardHeight * 2 + (BLEED_EDGE_MARGIN * 2);
                        console.log(`DXF Grid Info (4x2 layout):`);
                        console.log(`  Offset (bottom-left): (${cardX.toFixed(2)}mm, ${cardY.toFixed(2)}mm)`);
                        console.log(`  Grid dimensions: ${gridWidth.toFixed(2)}mm x ${gridHeight.toFixed(2)}mm`);
                        console.log(`  Card size: ${cardWidth}x${cardHeight}mm`);
                    }

                    // Generate rounded rectangle cut path for the card (without bleed margin)
                    dxfContent += generateRoundedRectangleDXF(
                        cardX,
                        cardY,
                        cardWidth,
                        cardHeight,
                        CUT_CORNER_RADIUS
                    );

                } catch (error) {
                    console.error(`Failed to render card ${card.id}:`, error);
                    // Draw placeholder rectangle for failed cards
                    const col = i % 4;
                    const row = Math.floor(i / 4);
                    const cellX = layout.x + col * layout.cellWidth;
                    const cellY = layout.y + row * layout.cellHeight;

                    // Center the card within the cell
                    const cardX = cellX + (layout.cellWidth - cardWidth) / 2;
                    const cardY = cellY + (layout.cellHeight - cardHeight) / 2;

                    const xPt = mmToPoints(cardX);
                    const yPt = mmToPoints(pageSettings.width - cardY - cardHeight);

                    page.drawRectangle({
                        x: xPt,
                        y: yPt,
                        width: mmToPoints(cardWidth),
                        height: mmToPoints(cardHeight),
                        borderColor: rgb(1, 0, 0),
                        borderWidth: 2,
                    });
                }
            }

            // Send progress update
            const percentage = Math.round(((pageNum + 1) / totalPages) * 100);
            self.postMessage({
                type: PDFWorkerMessageType.GENERATE_PDF_PROGRESS,
                payload: {
                    requestId,
                    currentPage: pageNum + 1,
                    totalPages,
                    percentage,
                },
            } satisfies PDFWorkerMessage);
        }

        // Check for cancellation before finalizing
        if (isCancelled || currentRequestId !== requestId) {
            return;
        }

        // Finalize DXF file
        dxfContent += generateDXFFooter();

        // Convert DXF content to bytes
        const dxfBytes = new TextEncoder().encode(dxfContent);

        // Save PDF to bytes
        const pdfBytes = await pdfDoc.save();

        // Send success response
        self.postMessage({
            type: PDFWorkerMessageType.GENERATE_PDF_SUCCESS,
            payload: {
                pdfBytes,
                dxfBytes,
                requestId,
                totalPages,
            },
        } satisfies PDFWorkerMessage);
    } catch (error) {
        console.error("PDF generation error:", error);
        self.postMessage({
            type: PDFWorkerMessageType.GENERATE_PDF_ERROR,
            payload: {
                error: error instanceof Error ? error.message : "Unknown error",
                requestId,
            },
        } satisfies PDFWorkerMessage);
    } finally {
        if (currentRequestId === requestId) {
            currentRequestId = null;
        }
    }
}

/**
 * Handle messages from main thread
 */
self.onmessage = async (event: MessageEvent<PDFWorkerMessage>) => {
    const message = event.data;

    switch (message.type) {
        case PDFWorkerMessageType.GENERATE_PDF:
            if ("cards" in message.payload) {
                await generatePDF(message as GeneratePDFRequest);
            }
            break;

        case PDFWorkerMessageType.CANCEL_GENERATION:
            if (currentRequestId === message.payload.requestId) {
                isCancelled = true;
                currentRequestId = null;
            }
            break;

        default:
            console.warn("Unknown message type:", (message as any).type);
    }
};
