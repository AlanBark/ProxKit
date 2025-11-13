import { PDFDocument, rgb } from "pdf-lib";
import { jsPDF } from "jspdf";

// Import registration background images
import registrationA4 from "../assets/a4_registration.jpg";
import registrationLetter from "../assets/letter_registration.jpg";

import {
    PDFWorkerMessageType,
    type PDFWorkerMessage
} from "../utils/pdf/workerTypes";

import type { CardImage, PageSettings } from "../types/card";

/**
 * PDF Worker - Handles PDF generation in background thread
 * This worker creates a single jsPDF file
 * This worker also merges any amount of PDF files.
 *  Merges are done with this worker as well to keep off the main thread + not have to spin a new one up
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
 * 
 */
interface PlaceImageParams {
    card: CardImage;
    cardWidth: number;
    cardHeight: number;
    pageNumber: number;
    position: {
        col: number;
        row: number;
    };
    gridLayout: {
        x: number;
        y: number;
        cellWidth: number;
        cellHeight: number;
    };
    pdfRef: jsPDF
}

/**
 * Places an image on the PDF file. Each web worker does this.
 * Uses jsPDF exclusively
 *
 * This places on the current page of the pdfRef
 *
 * @param request
 */
async function cropAndPlaceImage({
    card,
    cardWidth,
    cardHeight,
    position,
    gridLayout,
    pdfRef
}: PlaceImageParams): Promise<void> {

    // Crop the image to remove bleed
    const croppedImage = await cropImageBleed(
        card.imageUrl,
        card.bleed,
        cardWidth,
        cardHeight
    );

    // Convert cropped image bytes to data URL for jsPDF
    // Note: Using Blob directly is more efficient than base64 string manipulation
    const imageBlob = new Blob([croppedImage.imageBytes.buffer as ArrayBuffer], { type: 'image/png' });
    const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read image data'));
        reader.readAsDataURL(imageBlob);
    });

    // Calculate position in mm
    // gridLayout.cellWidth/cellHeight include the bleed margin spacing
    const cellX = gridLayout.x + position.col * gridLayout.cellWidth;
    const cellY = gridLayout.y + position.row * gridLayout.cellHeight;

    // Center the cropped image within its cell
    const offsetX = cellX + (gridLayout.cellWidth - croppedImage.widthMm) / 2;
    const offsetY = cellY + (gridLayout.cellHeight - croppedImage.heightMm) / 2;

    // jsPDF uses top-left origin in landscape mode
    pdfRef.addImage(
        imageDataUrl,
        'PNG',
        offsetX,
        offsetY,
        croppedImage.widthMm,
        croppedImage.heightMm,
        `card_${card.id}`,  // Alias for potential reuse
        'FAST'  // Use FAST compression for performance
    );
}



/*
* Given a chunk of data (an array of CardImage), generate a pdf of x pages long
* X is CardImage length / cards per page
* Using transferable objects only, no shared array buffer
*/
async function generateChunk(
    cards: (CardImage | null)[],
    pageSettings: PageSettings,
    cardWidth: number,
    cardHeight: number,
    requestId: string
): Promise<{ pdfBytes: Uint8Array; totalPages: number }> {

    // Constants
    const CARDS_PER_PAGE = 8; // 4x2 grid
    const COLS = 4;

    // Calculate total pages needed
    const totalPages = Math.ceil(cards.length / CARDS_PER_PAGE);

    // Initialize jsPDF document
    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [pageSettings.height, pageSettings.width] // Swapped for landscape
    });

    // Calculate grid layout once (same for all pages)
    const gridLayout = calculateGridLayout(
        pageSettings.height,  // Landscape width
        pageSettings.width,   // Landscape height
        cardWidth + (2 * BLEED_EDGE_MARGIN),  // Cell width with margin spacing
        cardHeight + (2 * BLEED_EDGE_MARGIN)  // Cell height with margin spacing
    );

    // Load and cache registration background ONCE (not per page)
    const registrationBg = pageSettings.width === 210 ? registrationA4 : registrationLetter;
    let bgDataUrl: string | null = null;
    try {
        const bgResponse = await fetch(registrationBg);
        const bgBlob = await bgResponse.blob();
        bgDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(bgBlob);
        });
    } catch (error) {
        console.warn('Failed to load registration background:', error);
    }

    // Process each page
    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        // Check for cancellation
        if (isCancelled) {
            throw new Error('Generation cancelled');
        }

        // Add a new page for each page after the first
        if (pageNum > 0) {
            pdf.addPage([pageSettings.height, pageSettings.width], 'landscape');
        }

        // Add registration background at full page size (if loaded)
        if (bgDataUrl) {
            pdf.addImage(
                bgDataUrl,
                'JPEG',
                0,
                0,
                pageSettings.height,  // Landscape width
                pageSettings.width,   // Landscape height
                undefined,
                'FAST'
            );
        }

        // Process cards for this page
        const startIdx = pageNum * CARDS_PER_PAGE;
        const endIdx = Math.min(startIdx + CARDS_PER_PAGE, cards.length);
        const pageCards = cards.slice(startIdx, endIdx);

        // Place each card on the page
        for (let i = 0; i < pageCards.length; i++) {
            const card = pageCards[i];

            // Skip null cards (blank placeholders)
            if (!card) continue;

            // Calculate grid position
            const col = i % COLS;
            const row = Math.floor(i / COLS);

            // Place the card image
            await cropAndPlaceImage({
                card,
                cardWidth,
                cardHeight,
                pageNumber: pageNum,
                position: { col, row },
                gridLayout,
                pdfRef: pdf
            });

            // Send progress update
            const cardIndex = startIdx + i;
            const percentage = Math.round((cardIndex / cards.length) * 100);
            self.postMessage({
                type: PDFWorkerMessageType.GENERATE_PDF_PROGRESS,
                payload: {
                    requestId,
                    currentPage: pageNum + 1,
                    totalPages,
                    percentage
                }
            } satisfies PDFWorkerMessage);
        }
    }

    // Convert jsPDF to ArrayBuffer for transferable objects
    const pdfArrayBuffer = pdf.output('arraybuffer');
    const pdfBytes = new Uint8Array(pdfArrayBuffer);

    return {
        pdfBytes,
        totalPages
    };
}

/**
 * Message event handler for worker communication
 */
self.addEventListener('message', async (event: MessageEvent<PDFWorkerMessage>) => {
    const message = event.data;

    switch (message.type) {
        case PDFWorkerMessageType.GENERATE_PDF: {
            const { cards, pageSettings, cardWidth, cardHeight, requestId } = message.payload;

            // Store current request ID and reset cancellation flag
            currentRequestId = requestId;
            isCancelled = false;

            try {
                // Generate the PDF chunk
                const result = await generateChunk(
                    cards,
                    pageSettings,
                    cardWidth,
                    cardHeight,
                    requestId
                );

                // Check if request was cancelled during generation
                if (isCancelled || currentRequestId !== requestId) {
                    return;
                }

                // Send success response with transferable objects
                const dxfBytes = new Uint8Array(); // TODO: Implement DXF generation
                const successMessage: PDFWorkerMessage = {
                    type: PDFWorkerMessageType.GENERATE_PDF_SUCCESS,
                    payload: {
                        pdfBytes: result.pdfBytes,
                        dxfBytes,
                        requestId,
                        totalPages: result.totalPages
                    }
                };

                // Transfer ownership of ArrayBuffers to main thread (zero-copy)
                // Use the structured clone algorithm with transfer list
                self.postMessage(successMessage, {
                    transfer: [result.pdfBytes.buffer, dxfBytes.buffer]
                });

            } catch (error) {
                // Only send error if request wasn't cancelled
                if (!isCancelled && currentRequestId === requestId) {
                    const errorMessage: PDFWorkerMessage = {
                        type: PDFWorkerMessageType.GENERATE_PDF_ERROR,
                        payload: {
                            error: error instanceof Error ? error.message : 'Unknown error',
                            requestId
                        }
                    };
                    self.postMessage(errorMessage);
                }
            }
            break;
        }

        case PDFWorkerMessageType.CANCEL_GENERATION: {
            const { requestId } = message.payload;
            if (currentRequestId === requestId) {
                isCancelled = true;
                currentRequestId = null;
            }
            break;
        }

        default:
            console.warn('Unknown message type:', message);
    }
});