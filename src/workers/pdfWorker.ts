import { jsPDF } from "jspdf";

// Import registration background images
import registrationA4 from "../assets/a4_registration.jpg";
import registrationLetter from "../assets/letter_registration.jpg";

import {
    PDFWorkerMessageType,
    type PDFWorkerMessage
} from "../utils/pdf/workerTypes";

import type { CardImage, PageSettings } from "../types/card";

import {
    calculateGridLayout,
    calculateCardPosition,
    calculateMirroredColumn,
    CARDS_PER_PAGE,
    GRID_COLS,
    type GridLayout,
    type CardPosition,
} from "../utils/pdf/cardLayoutUtils";

/**
 * PDF Worker - Handles PDF generation in background thread
 * This worker creates a single jsPDF file
 * This worker also merges any amount of PDF files.
 *  Merges are done with this worker as well to keep off the main thread + not have to spin a new one up
 */

let currentRequestId: string | null = null;
let isCancelled = false;


/**
 * Crop image canvas by removing bleed
 *
 * The input image includes bleed area. We need to crop it to get only the card area.
 *
 * Logic:
 * - If bleed > 0: crop (bleed - outputBleed) from each side
 * - If bleed = 0: add outputBleed as an edge (negative crop = expand)
 *
 * For example:
 * - Card dimensions (without bleed): 63mm x 88mm
 * - Bleed: 3mm on all sides
 * - outputBleed: 1mm
 * - Total image represents: (63 + 3*2) x (88 + 3*2) = 69mm x 94mm
 * - We crop 2mm (3mm - 1mm) from each side to get a 65mm x 90mm result
 *
 * @param flipHorizontal If true, flip the image horizontally (for card backs)
 * @returns Object containing the cropped image bytes and actual dimensions in mm
 */
async function cropImageBleed(
    imageUrl: string,
    bleed: number,
    cardWidth: number,
    cardHeight: number,
    outputBleed: number,
    flipHorizontal: boolean = false
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

    // Calculate effective crop amount: bleed - outputBleed
    // If bleed is 0, this becomes negative, which means we'll expand the image
    const effectiveCrop = bleed - outputBleed;

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

    // Apply horizontal flip if needed (for card backs)
    if (flipHorizontal) {
        ctx.translate(croppedWidth, 0);
        ctx.scale(-1, 1);
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
 * Parameters for placing a card image on the PDF
 */
interface PlaceImageParams {
    card: CardImage;
    cardWidth: number;
    cardHeight: number;
    outputBleed: number;
    pageNumber: number;
    position: CardPosition;
    gridLayout: GridLayout;
    pdfRef: jsPDF;
    flipHorizontal?: boolean;
}

/**
 * Places a card back image on the PDF
 * Uses the card's custom back if available, otherwise uses the default
 * If no back is available at all, doesn't place anything
 */
async function cropAndPlaceCardBack({
    card,
    cardWidth,
    cardHeight,
    outputBleed,
    position,
    gridLayout,
    pdfRef,
    defaultCardBackUrl
}: PlaceImageParams & { defaultCardBackUrl: string | null }): Promise<void> {
    // Determine which card back to use
    const cardBackUrl = card.cardBackUrl || defaultCardBackUrl;

    // If no card back exists, don't place anything
    if (!cardBackUrl) {
        return;
    }

    // Get the appropriate bleed value for the back
    const backBleed = card.cardBackUrl ? card.cardBackBleed : card.cardBackBleed;

    // Crop the card back image (NO flip - only positions are mirrored)
    const croppedImage = await cropImageBleed(
        cardBackUrl,
        backBleed,
        cardWidth,
        cardHeight,
        outputBleed,
        false // Don't flip individual images - only positions are mirrored on the page
    );

    // Convert cropped image bytes to data URL for jsPDF
    const imageBlob = new Blob([croppedImage.imageBytes.buffer as ArrayBuffer], { type: 'image/png' });
    const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read image data'));
        reader.readAsDataURL(imageBlob);
    });

    // Calculate position in mm
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
        `card_back_${card.id}`,  // Alias for potential reuse
    );
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
    outputBleed,
    position,
    gridLayout,
    pdfRef,
    flipHorizontal = false
}: PlaceImageParams): Promise<void> {

    // Crop the image to remove bleed
    const croppedImage = await cropImageBleed(
        card.imageUrl,
        card.bleed,
        cardWidth,
        cardHeight,
        outputBleed,
        flipHorizontal
    );

    // Convert cropped image bytes to data URL for jsPDF
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
    outputBleed: number,
    enableCardBacks: boolean,
    defaultCardBackUrl: string | null,
    skipSlots: number[],
    requestId: string
): Promise<{ pdfBytes: Uint8Array; totalPages: number }> {
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
        cardWidth + (2 * outputBleed),  // Cell width with margin spacing
        cardHeight + (2 * outputBleed)  // Cell height with margin spacing
    );

    // Load and cache registration background ONCE (not per page)
    const registrationBg = pageSettings.width === 210 ? registrationA4 : registrationLetter;
    let bgDataUrl: string | null = null;
    const bgResponse = await fetch(registrationBg);
    const bgBlob = await bgResponse.blob();
    bgDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(bgBlob);
    });

    // Process each page
    let imageCount = 0;
    let actualPageNum = 0; // Track actual page number including backs

    for (let pageNum = 0; pageNum < totalPages; pageNum++) {

        // Check for cancellation
        if (isCancelled) {
            throw new Error('Generation cancelled');
        }

        // Add a new page for each page after the first
        if (actualPageNum > 0) {
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

        // Place each card FRONT on the page
        for (let i = 0; i < pageCards.length; i++) {
            const card = pageCards[i];

            // Skip if this slot should be skipped
            if (skipSlots.includes(i)) continue;

            // Skip null cards (blank placeholders)
            if (!card) continue;

            // Calculate grid position
            const position = calculateCardPosition(i);

            // Place the card front image
            await cropAndPlaceImage({
                card,
                cardWidth,
                cardHeight,
                outputBleed,
                pageNumber: pageNum,
                position,
                gridLayout,
                pdfRef: pdf
            });
            imageCount++;

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

        actualPageNum++;

        // If card backs are enabled, add a back page immediately after this front page
        if (enableCardBacks) {
            // Add a new page for the backs
            pdf.addPage([pageSettings.height, pageSettings.width], 'landscape');

            // Add registration background for back page
            if (bgDataUrl) {
                pdf.addImage(
                    bgDataUrl,
                    'JPEG',
                    0,
                    0,
                    pageSettings.height,
                    pageSettings.width,
                    undefined,
                    'FAST'
                );
            }

            // Place each card BACK on the page
            // For double-sided printing, we mirror positions horizontally
            // This way when you flip the paper over, the backs align with the fronts
            for (let i = 0; i < pageCards.length; i++) {
                const card = pageCards[i];

                // Skip if this slot should be skipped
                if (skipSlots.includes(i)) continue;

                // Skip null cards
                if (!card) continue;

                // Calculate MIRRORED grid position for proper alignment when page is flipped
                // Mirror horizontally: column 0 becomes 3, 1 becomes 2, 2 becomes 1, 3 becomes 0
                // Images themselves are NOT flipped, only their positions
                const originalPosition = calculateCardPosition(i);
                const mirroredCol = calculateMirroredColumn(originalPosition.col);
                const position: CardPosition = {
                    col: mirroredCol,
                    row: originalPosition.row
                };

                // Place the card back image at mirrored position
                await cropAndPlaceCardBack({
                    card,
                    cardWidth,
                    cardHeight,
                    outputBleed,
                    pageNumber: actualPageNum,
                    position,
                    gridLayout,
                    pdfRef: pdf,
                    defaultCardBackUrl
                });
            }

            actualPageNum++;
        }
    }

    // Convert PDF to Uint8Array for transferable ArrayBuffer
    const pdfBlob = pdf.output('blob');
    const pdfArrayBuffer = await pdfBlob.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfArrayBuffer);

    return {
        totalPages: actualPageNum, // Return actual page count including backs
        pdfBytes
    };
}

/**
 * Message event handler for worker communication
 */
self.addEventListener('message', async (event: MessageEvent<PDFWorkerMessage>) => {
    const message = event.data;

    switch (message.type) {
        case PDFWorkerMessageType.GENERATE_PDF: {
            const { cards, pageSettings, cardWidth, cardHeight, outputBleed, enableCardBacks, defaultCardBackUrl, skipSlots, requestId } = message.payload;

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
                    outputBleed,
                    enableCardBacks,
                    defaultCardBackUrl,
                    skipSlots,
                    requestId
                );

                // Check if request was cancelled during generation
                if (isCancelled || currentRequestId !== requestId) {
                    return;
                }

                // Send success response with transferable objects
                const successMessage: PDFWorkerMessage = {
                    type: PDFWorkerMessageType.GENERATE_PDF_SUCCESS,
                    payload: {
                        pdfBytes: result.pdfBytes,
                        requestId,
                        totalPages: result.totalPages
                    }
                };

                // Transfer ownership of ArrayBuffers to main thread (zero-copy)
                // Use the structured clone algorithm with transfer list
                self.postMessage(successMessage, {
                    transfer: [result.pdfBytes.buffer]
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