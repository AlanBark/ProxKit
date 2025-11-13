import type { CardImage, PageSettings } from "../../types/card";
import {
    PDFWorkerMessageType,
    type GeneratePDFRequest,
    type PDFWorkerMessage,
} from "./workerTypes";
import { PDFDocument } from "pdf-lib";

/**
 * Progress callback for PDF generation
 */
export type ProgressCallback = (current: number, total: number, percentage: number) => void;

/**
 * Configuration for worker pool
 */
const CARDS_PER_PAGE = 8; // 4x2 grid
const MAX_WORKERS = 8; // Maximum concurrent workers

/**
 * Worker chunk result
 */
interface WorkerChunkResult {
    chunkIndex: number;
    pdfBytes: Uint8Array;
    dxfBytes: Uint8Array;
    totalPages: number;
}

/**
 * PDFManager - Main thread interface for PDF generation
 *
 * This manager uses Web Workers with Transferable Objects for performance
 */
export class PDFManager {
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
    }

    /**
     * Create a worker instance
     */
    private createWorker(): Worker {
        try {
            const worker = new Worker(
                new URL("../../workers/pdfWorker.ts", import.meta.url),
                { type: "module" }
            );
            return worker;
        } catch (error) {
            console.error("Failed to create PDF worker:", error);
            throw new Error("PDF worker creation failed");
        }
    }

    /**
     * Split cards into chunks for parallel processing
     * 1 worker per page, up to MAX_WORKERS
     */
    private chunkCards(cards: (CardImage | null)[]): (CardImage | null)[][] {
        const totalPages = Math.ceil(cards.length / CARDS_PER_PAGE);
        const numWorkers = Math.min(totalPages, MAX_WORKERS);

        if (numWorkers === 1) {
            // Single worker gets all cards
            return [cards];
        }

        // Distribute pages evenly across workers
        const pagesPerWorker = Math.ceil(totalPages / numWorkers);
        const cardsPerWorker = pagesPerWorker * CARDS_PER_PAGE;

        const chunks: (CardImage | null)[][] = [];
        for (let i = 0; i < cards.length; i += cardsPerWorker) {
            chunks.push(cards.slice(i, i + cardsPerWorker));
        }

        return chunks;
    }

    /**
     * Merge multiple PDF documents using pdf-lib
     * Maintains page order based on chunk indices
     */
    private async mergePDFs(results: WorkerChunkResult[]): Promise<Uint8Array> {
        // Sort results by chunk index to maintain order
        const sortedResults = results.sort((a, b) => a.chunkIndex - b.chunkIndex);

        // Single PDF? No merging needed
        if (sortedResults.length === 1) {
            return sortedResults[0].pdfBytes;
        }

        // Create new PDF document for merging
        const mergedPdf = await PDFDocument.create();

        // Load and merge each chunk
        for (const result of sortedResults) {
            try {
                const chunkPdf = await PDFDocument.load(result.pdfBytes);
                const pageIndices = Array.from({ length: chunkPdf.getPageCount() }, (_, i) => i);
                const copiedPages = await mergedPdf.copyPages(chunkPdf, pageIndices);

                for (const page of copiedPages) {
                    mergedPdf.addPage(page);
                }
            } catch (error) {
                console.error(`Failed to merge PDF chunk ${result.chunkIndex}:`, error);
                throw new Error(`PDF merge failed for chunk ${result.chunkIndex}`);
            }
        }

        // Return merged PDF as bytes
        const mergedBytes = await mergedPdf.save();
        return new Uint8Array(mergedBytes);
    }

    /**
     * Merge multiple DXF files
     * For now, just concatenate them (DXF is text-based)
     */
    private mergeDXFs(results: WorkerChunkResult[]): Uint8Array {
        // Sort results by chunk index to maintain order
        const sortedResults = results.sort((a, b) => a.chunkIndex - b.chunkIndex);

        // Single DXF? No merging needed
        if (sortedResults.length === 1) {
            return sortedResults[0].dxfBytes;
        }

        // TODO: Proper DXF merging when DXF generation is implemented
        // For now, just return the first one
        return sortedResults[0].dxfBytes;
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
     * Generate PDF from cards using multi-worker parallelization
     *
     * Performance: Uses transferable objects for zero-copy data transfer.
     * - Splits cards into chunks (1 worker per page, max 8 workers)
     * - Each worker generates a jsPDF document for its chunk
     * - Results transferred back via ArrayBuffer (zero-copy)
     * - Main thread merges PDFs using pdf-lib
     *
     * @param cards Array of cards (null = blank placeholder)
     * @returns Promise resolving to blob URL of generated PDF
     */
    public async generatePDF(cards: (CardImage | null)[]): Promise<string> {
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

        try {
            // Split cards into chunks for parallel processing
            const chunks = this.chunkCards(cards);
            const numWorkers = chunks.length;

            console.log(`Generating PDF with ${numWorkers} worker(s) for ${cards.length} cards`);

            // Track progress across all workers
            const progressTracker = new Map<number, number>(); // chunkIndex -> percentage
            const updateProgress = () => {
                const totalProgress = Array.from(progressTracker.values()).reduce((sum, p) => sum + p, 0);
                const avgProgress = totalProgress / numWorkers;
                const totalPages = Math.ceil(cards.length / CARDS_PER_PAGE);
                const currentPage = Math.ceil((avgProgress / 100) * totalPages);

                if (this.onProgress) {
                    this.onProgress(currentPage, totalPages, Math.round(avgProgress));
                }
            };

            // Create workers and dispatch chunks
            const workerPromises = chunks.map((chunk, chunkIndex) => {
                return new Promise<WorkerChunkResult>((resolve, reject) => {
                    const worker = this.createWorker();
                    const chunkRequestId = `${requestId}_chunk_${chunkIndex}`;

                    // Set up progress tracking for this worker
                    progressTracker.set(chunkIndex, 0);

                    const handleMessage = (event: MessageEvent<PDFWorkerMessage>) => {
                        const message = event.data;

                        if (message.payload.requestId !== chunkRequestId) {
                            return; // Ignore messages for other requests
                        }

                        switch (message.type) {
                            case PDFWorkerMessageType.GENERATE_PDF_PROGRESS:
                                if ("percentage" in message.payload) {
                                    progressTracker.set(chunkIndex, message.payload.percentage);
                                    updateProgress();
                                }
                                break;

                            case PDFWorkerMessageType.GENERATE_PDF_SUCCESS:
                                worker.removeEventListener("message", handleMessage);
                                worker.terminate();

                                if ("pdfBytes" in message.payload && "dxfBytes" in message.payload) {
                                    resolve({
                                        chunkIndex,
                                        pdfBytes: message.payload.pdfBytes,
                                        dxfBytes: message.payload.dxfBytes,
                                        totalPages: message.payload.totalPages,
                                    });
                                }
                                break;

                            case PDFWorkerMessageType.GENERATE_PDF_ERROR:
                                worker.removeEventListener("message", handleMessage);
                                worker.terminate();

                                if ("error" in message.payload) {
                                    reject(new Error(`Worker ${chunkIndex}: ${message.payload.error}`));
                                }
                                break;
                        }
                    };

                    const handleError = (error: ErrorEvent) => {
                        worker.removeEventListener("message", handleMessage);
                        worker.terminate();
                        reject(new Error(`Worker ${chunkIndex} error: ${error.message}`));
                    };

                    worker.addEventListener("message", handleMessage);
                    worker.addEventListener("error", handleError);

                    // Send chunk to worker
                    const request: GeneratePDFRequest = {
                        type: PDFWorkerMessageType.GENERATE_PDF,
                        payload: {
                            cards: chunk,
                            pageSettings: this.pageSettings,
                            cardWidth: this.cardWidth,
                            cardHeight: this.cardHeight,
                            requestId: chunkRequestId,
                        },
                    };

                    worker.postMessage(request);
                });
            });

            // Wait for all workers to complete
            const results = await Promise.all(workerPromises);

            // Check if request was cancelled during generation
            if (this.currentRequestId !== requestId) {
                throw new Error("Generation cancelled");
            }

            // Merge PDFs on main thread using pdf-lib
            console.log(`Merging ${results.length} PDF chunks...`);
            const mergedPdfBytes = await this.mergePDFs(results);
            const mergedDxfBytes = this.mergeDXFs(results);

            // Convert merged PDF bytes to blob URL
            const pdfBlob = new Blob([mergedPdfBytes.buffer as ArrayBuffer], {
                type: "application/pdf",
            });

            const dxfBlob = new Blob([mergedDxfBytes.buffer as ArrayBuffer], {
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

            console.log("PDF generation complete!");
            return this.cachedPdfUrl;

        } catch (error) {
            this.currentRequestId = null;
            console.error("PDF generation failed:", error);
            throw error;
        }
    }

    /**
     * Cancel ongoing PDF generation
     */
    public cancelGeneration(): void {
        if (this.currentRequestId) {
            // Note: Workers will be terminated when promises reject
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
    }
}
