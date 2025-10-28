import { PDFDocument, rgb } from "pdf-lib";
import type { CardImage } from "../types/card";
import { layoutCards } from "../utils/pdf/cardLayout";
import {
    PDFWorkerMessageType,
    type GeneratePDFRequest,
    type PDFWorkerMessage,
} from "../utils/pdf/workerTypes";

/**
 * PDF Worker - Handles PDF generation in background thread
 */

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
 * Generate PDF with progress reporting and cancellation support
 */
async function generatePDF(request: GeneratePDFRequest): Promise<void> {
    const { cards, pageSettings, cardWidth, cardHeight, requestId } = request.payload;

    currentRequestId = requestId;
    isCancelled = false;

    try {
        // Create new PDF document
        const pdfDoc = await PDFDocument.create();

        // Calculate card layout across pages
        const validCards = cards.filter((card): card is CardImage => card !== null);
        const layout = layoutCards(validCards, pageSettings);

        const totalPages = layout.totalPages;

        // Group positions by page for efficient rendering
        const pageGroups = new Map<number, typeof layout.positions>();
        for (const position of layout.positions) {
            if (!pageGroups.has(position.page)) {
                pageGroups.set(position.page, []);
            }
            pageGroups.get(position.page)!.push(position);
        }

        // Process each page
        for (let pageNum = 0; pageNum < totalPages; pageNum++) {
            // Check for cancellation
            if (isCancelled || currentRequestId !== requestId) {
                return;
            }

            // Report progress
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

            // Add page with proper dimensions
            const pageWidthPt = mmToPoints(pageSettings.width);
            const pageHeightPt = mmToPoints(pageSettings.height);
            const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);

            // Get cards for this page
            const cardsOnPage = pageGroups.get(pageNum) || [];

            // Render each card on the page
            for (const position of cardsOnPage) {
                try {
                    const card = position.card;

                    // Fetch and embed image
                    const imageBytes = await fetchImageAsBytes(card.imageUrl);
                    let embeddedImage;

                    try {
                        embeddedImage = await pdfDoc.embedPng(imageBytes);
                    } catch {
                        embeddedImage = await pdfDoc.embedJpg(imageBytes);
                    }

                    // Calculate dimensions with bleed
                    const cardWidthWithBleed = cardWidth + card.bleed * 2;
                    const cardHeightWithBleed = cardHeight + card.bleed * 2;

                    const widthPt = mmToPoints(cardWidthWithBleed);
                    const heightPt = mmToPoints(cardHeightWithBleed);

                    // Convert position to points (flip Y axis for PDF coordinate system)
                    const xPt = mmToPoints(position.x - card.bleed);
                    const yPt = mmToPoints(pageSettings.height - position.y - cardHeightWithBleed + card.bleed);

                    // Draw image
                    page.drawImage(embeddedImage, {
                        x: xPt,
                        y: yPt,
                        width: widthPt,
                        height: heightPt,
                    });

                    // Draw cut line (red rectangle outline)
                    const cutLineX = mmToPoints(position.x);
                    const cutLineY = mmToPoints(pageSettings.height - position.y - cardHeight);
                    page.drawRectangle({
                        x: cutLineX,
                        y: cutLineY,
                        width: mmToPoints(cardWidth),
                        height: mmToPoints(cardHeight),
                        borderColor: rgb(1, 0, 0),
                        borderWidth: 0.5,
                    });
                } catch (error) {
                    console.error(`Failed to render card ${position.card.id}:`, error);
                    // Draw placeholder rectangle for failed cards
                    const xPt = mmToPoints(position.x);
                    const yPt = mmToPoints(pageSettings.height - position.y - cardHeight);
                    page.drawRectangle({
                        x: xPt,
                        y: yPt,
                        width: mmToPoints(cardWidth),
                        height: mmToPoints(cardHeight),
                        borderColor: rgb(1, 0, 0),
                        borderWidth: 1,
                    });
                }
            }
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
