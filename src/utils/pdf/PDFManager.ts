import type { CardImage, PageSettings } from "../../types/card";
import {
    PDFWorkerMessageType,
    type GeneratePDFRequest,
    type PDFWorkerMessage,
} from "./workerTypes";

/**
 * Progress callback for PDF generation
 */
export type ProgressCallback = (current: number, total: number, percentage: number) => void;

/**
 * PDFManager - Main thread interface for PDF generation
 *
 * Features:
 * - Offloads PDF generation to web worker (non-blocking)
 * - Progress reporting during generation
 * - Automatic caching with invalidation
 * - Support for null cards (blank placeholders)
 * - Optimized incremental generation
 *
 * Usage:
 * ```ts
 * const manager = new PDFManager(pageSettings, cardWidth, cardHeight);
 *
 * manager.onProgress = (current, total, percentage) => {
 *   console.log(`Generating page ${current}/${total} (${percentage}%)`);
 * };
 *
 * const pdfUrl = await manager.generatePDF(cards);
 * // Use pdfUrl for download/display
 *
 * manager.dispose(); // Clean up when done
 * ```
 */
export class PDFManager {
    private worker: Worker | null = null;
    private currentRequestId: string | null = null;
    private cachedPdfUrl: string | null = null;
    private cachedDxfUrl: string | null = null;
    private cachedCardsHash: string | null = null;
    private pageSettings: PageSettings;
    private cardWidth: number;
    private cardHeight: number;

    /**
     * Optional callback for progress updates
     */
    public onProgress: ProgressCallback | null = null;

    /**
     * Create a new PDF manager
     *
     * @param pageSettings Page size and margin configuration
     * @param cardWidth Card width in mm
     * @param cardHeight Card height in mm
     */
    constructor(pageSettings: PageSettings, cardWidth: number, cardHeight: number) {
        this.pageSettings = pageSettings;
        this.cardWidth = cardWidth;
        this.cardHeight = cardHeight;
        this.initializeWorker();
    }

    /**
     * Initialize the web worker
     */
    private initializeWorker(): void {
        try {
            this.worker = new Worker(
                new URL("../../workers/pdfWorker.ts", import.meta.url),
                { type: "module" }
            );

            this.worker.onmessage = this.handleWorkerMessage.bind(this);
            this.worker.onerror = this.handleWorkerError.bind(this);
        } catch (error) {
            console.error("Failed to initialize PDF worker:", error);
            throw new Error("PDF worker initialization failed");
        }
    }

    /**
     * Handle messages from the worker
     */
    private handleWorkerMessage(event: MessageEvent<PDFWorkerMessage>): void {
        const message = event.data;

        switch (message.type) {
            case PDFWorkerMessageType.GENERATE_PDF_PROGRESS:
                if (this.onProgress && "currentPage" in message.payload) {
                    if (message.payload.requestId === this.currentRequestId) {
                        this.onProgress(
                            message.payload.currentPage,
                            message.payload.totalPages,
                            message.payload.percentage
                        );
                    }
                }
                break;

            case PDFWorkerMessageType.GENERATE_PDF_SUCCESS:
                // Handled by promise in generatePDF
                break;

            case PDFWorkerMessageType.GENERATE_PDF_ERROR:
                // Handled by promise in generatePDF
                break;
        }
    }

    /**
     * Handle worker errors
     */
    private handleWorkerError(error: ErrorEvent): void {
        console.error("PDF worker error:", error);
    }

    /**
     * Generate a hash of the cards array for cache invalidation
     */
    private hashCards(cards: (CardImage | null)[]): string {
        const cardData = cards.map((card) => {
            if (card === null) return "null";
            return `${card.id}-${card.bleed}`;
        });
        return JSON.stringify(cardData);
    }

    /**
     * Update page settings (invalidates cache)
     */
    public updatePageSettings(pageSettings: PageSettings): void {
        this.pageSettings = pageSettings;
        this.invalidateCache();
    }

    /**
     * Update card dimensions (invalidates cache)
     */
    public updateCardDimensions(width: number, height: number): void {
        this.cardWidth = width;
        this.cardHeight = height;
        this.invalidateCache();
    }

    /**
     * Generate PDF from cards
     *
     * @param cards Array of cards (null = blank placeholder)
     * @returns Promise resolving to blob URL of generated PDF
     */
    public async generatePDF(cards: (CardImage | null)[]): Promise<string> {
        if (!this.worker) {
            throw new Error("PDF worker not initialized");
        }

        // Check cache
        const cardsHash = this.hashCards(cards);
        if (this.cachedPdfUrl && this.cachedCardsHash === cardsHash) {
            return this.cachedPdfUrl;
        }

        // Cancel any ongoing generation
        if (this.currentRequestId) {
            this.cancelGeneration();
        }

        // Generate new request ID
        const requestId = crypto.randomUUID();
        this.currentRequestId = requestId;

        // Send generation request to worker
        return new Promise((resolve, reject) => {
            const handleMessage = (event: MessageEvent<PDFWorkerMessage>) => {
                const message = event.data;

                // Only handle messages for this request
                if (
                    message.type === PDFWorkerMessageType.GENERATE_PDF_SUCCESS &&
                    message.payload.requestId === requestId
                ) {
                    this.worker!.removeEventListener("message", handleMessage);

                    // Type guard ensures we have the right payload type
                    if ("pdfBytes" in message.payload && "dxfBytes" in message.payload) {
                        // Convert PDF bytes to blob URL
                        const pdfBlob = new Blob([new Uint8Array(message.payload.pdfBytes)], {
                            type: "application/pdf",
                        });

                        // Convert DXF bytes to blob URL
                        const dxfBlob = new Blob([new Uint8Array(message.payload.dxfBytes)], {
                            type: "application/dxf",
                        });

                        // Revoke old URLs to prevent memory leaks
                        if (this.cachedPdfUrl) {
                            URL.revokeObjectURL(this.cachedPdfUrl);
                        }
                        if (this.cachedDxfUrl) {
                            URL.revokeObjectURL(this.cachedDxfUrl);
                        }

                        // Cache new URLs
                        this.cachedPdfUrl = URL.createObjectURL(pdfBlob);
                        this.cachedDxfUrl = URL.createObjectURL(dxfBlob);
                        this.cachedCardsHash = cardsHash;
                        this.currentRequestId = null;

                        resolve(this.cachedPdfUrl);
                    }
                } else if (
                    message.type === PDFWorkerMessageType.GENERATE_PDF_ERROR &&
                    message.payload.requestId === requestId
                ) {
                    this.worker!.removeEventListener("message", handleMessage);
                    this.currentRequestId = null;
                    if ("error" in message.payload) {
                        reject(new Error(message.payload.error));
                    }
                }
            };

            this.worker!.addEventListener("message", handleMessage);

            // Send request
            const request: GeneratePDFRequest = {
                type: PDFWorkerMessageType.GENERATE_PDF,
                payload: {
                    cards,
                    pageSettings: this.pageSettings,
                    cardWidth: this.cardWidth,
                    cardHeight: this.cardHeight,
                    requestId,
                },
            };

            this.worker!.postMessage(request);
        });
    }

    /**
     * Cancel ongoing PDF generation
     */
    public cancelGeneration(): void {
        if (this.currentRequestId && this.worker) {
            this.worker.postMessage({
                type: PDFWorkerMessageType.CANCEL_GENERATION,
                payload: {
                    requestId: this.currentRequestId,
                },
            } satisfies PDFWorkerMessage);

            this.currentRequestId = null;
        }
    }

    /**
     * Invalidate cached PDF and DXF (forces regeneration on next request)
     */
    public invalidateCache(): void {
        if (this.cachedPdfUrl) {
            URL.revokeObjectURL(this.cachedPdfUrl);
            this.cachedPdfUrl = null;
        }
        if (this.cachedDxfUrl) {
            URL.revokeObjectURL(this.cachedDxfUrl);
            this.cachedDxfUrl = null;
        }
        this.cachedCardsHash = null;
    }

    /**
     * Check if PDF is currently being generated
     */
    public isGenerating(): boolean {
        return this.currentRequestId !== null;
    }

    /**
     * Get currently cached PDF URL (if available)
     */
    public getCachedUrl(): string | null {
        return this.cachedPdfUrl;
    }

    /**
     * Get currently cached DXF cut file URL (if available)
     */
    public getCachedDxfUrl(): string | null {
        return this.cachedDxfUrl;
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        this.cancelGeneration();
        this.invalidateCache();

        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}
