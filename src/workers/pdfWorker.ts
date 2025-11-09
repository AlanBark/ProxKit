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
const BLEED_EDGE_MARGIN = 1;

let currentRequestId: string | null = null;
let isCancelled = false;

/**
 * Convert millimeters to PDF points (1 point = 1/72 inch)
 */
function mmToPoints(mm: number): number {
    return (mm / 25.4) * 72;
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
 */
async function cropImageBleed(
    imageUrl: string,
    bleed: number,
    cardWidth: number,
    cardHeight: number
): Promise<Uint8Array> {
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
    const cropLeftPx = Math.floor(imgWidth * cropPercentX);
    const cropTopPx = Math.floor(imgHeight * cropPercentY);

    // Resulting cropped dimensions (remove effectiveCrop from both sides)
    const croppedWidth = imgWidth - (cropLeftPx * 2);
    const croppedHeight = imgHeight - (cropTopPx * 2);

    // Create canvas with the final cropped size
    const canvas = new OffscreenCanvas(croppedWidth, croppedHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get canvas context');
    }

    // Draw the cropped portion of the source image onto the canvas
    // Source: starting at (cropLeftPx, cropTopPx), take croppedWidth x croppedHeight pixels
    // Destination: draw at (0, 0) with full canvas size
    ctx.drawImage(
        imageBitmap,
        cropLeftPx, cropTopPx, croppedWidth, croppedHeight,  // Source rectangle (what to take from source)
        0, 0, croppedWidth, croppedHeight                     // Destination rectangle (where to put it)
    );

    // Convert canvas to PNG blob
    const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
    const arrayBuffer = await croppedBlob.arrayBuffer();

    return new Uint8Array(arrayBuffer);
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

        // Determine which registration background to use
        const registrationBg = getRegistrationBackground(pageSettings);

        // Fetch and embed the registration background
        const bgBytes = await fetchImageAsBytes(registrationBg);
        let bgImage = await pdfDoc.embedJpg(bgBytes);

        const cardsPerPage = 8;
        const totalPages = Math.ceil(cards.length / cardsPerPage);

        // Calculate grid layout for centered 4x2 arrangement
        const layout = calculateGridLayout(
            pageSettings.height,  // Landscape width in mm
            pageSettings.width,   // Landscape height in mm
            cardWidth,
            cardHeight
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
                    const croppedImageBytes = await cropImageBleed(
                        card.imageUrl,
                        card.bleed,
                        cardWidth,
                        cardHeight
                    );

                    // Embed the cropped image
                    const embeddedImage = await pdfDoc.embedPng(croppedImageBytes);

                    // Calculate position in mm
                    const cardX = layout.x + col * layout.cellWidth;
                    const cardY = layout.y + row * layout.cellHeight;

                    // Convert to points (flip Y axis for PDF coordinate system)
                    const xPt = mmToPoints(cardX);
                    const yPt = mmToPoints(pageSettings.width - cardY - cardHeight);  // Flip Y

                    const widthPt = mmToPoints(cardWidth);
                    const heightPt = mmToPoints(cardHeight);

                    // Draw the cropped image
                    page.drawImage(embeddedImage, {
                        x: xPt,
                        y: yPt,
                        width: widthPt,
                        height: heightPt,
                    });

                } catch (error) {
                    console.error(`Failed to render card ${card.id}:`, error);
                    // Draw placeholder rectangle for failed cards
                    const col = i % 4;
                    const row = Math.floor(i / 4);
                    const cardX = layout.x + col * layout.cellWidth;
                    const cardY = layout.y + row * layout.cellHeight;
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

        // Save PDF to bytes
        const pdfBytes = await pdfDoc.save();

        // Send success response
        self.postMessage({
            type: PDFWorkerMessageType.GENERATE_PDF_SUCCESS,
            payload: {
                pdfBytes,
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
