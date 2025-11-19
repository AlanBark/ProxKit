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
const MAX_WORKERS = 4; // Maximum concurrent workers

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
        const minPagesPerWorker = Math.floor(totalPages / numWorkers);
        const minCardsPerWorker = minPagesPerWorker * CARDS_PER_PAGE;
        let sparePagesPerWorker = totalPages % numWorkers;
        let chunkStartIndex = 0;

        const chunks: (CardImage | null)[][] = [];
        for (let i = 0; i < numWorkers; i++) {
            let chunkEndIndex = chunkStartIndex + minCardsPerWorker;
            if (sparePagesPerWorker > 0) {
                chunkEndIndex += CARDS_PER_PAGE;
            }
            chunks.push(cards.slice(chunkStartIndex, chunkEndIndex));
            chunkStartIndex = chunkEndIndex;
            sparePagesPerWorker -= 1;
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
            console.log(`[PDFManager] Single PDF, no merge needed`);
            return sortedResults[0].pdfBytes;
        }

        // Create new PDF document for merging
        const createStart = performance.now();
        const mergedPdf = await PDFDocument.create();
        const createTime = performance.now() - createStart;
        console.log(`[PDFManager] Created merge document in ${createTime.toFixed(2)}ms`);

        // Load and merge each chunk
        for (const result of sortedResults) {
            const chunkStart = performance.now();
            try {
                const loadStart = performance.now();
                const chunkPdf = await PDFDocument.load(result.pdfBytes);
                const loadTime = performance.now() - loadStart;

                const copyStart = performance.now();
                const pageIndices = Array.from({ length: chunkPdf.getPageCount() }, (_, i) => i);
                const copiedPages = await mergedPdf.copyPages(chunkPdf, pageIndices);
                const copyTime = performance.now() - copyStart;

                const addStart = performance.now();
                for (const page of copiedPages) {
                    mergedPdf.addPage(page);
                }
                const addTime = performance.now() - addStart;

                const chunkTime = performance.now() - chunkStart;
                console.log(`[PDFManager] Merged chunk ${result.chunkIndex} (${chunkPdf.getPageCount()} pages) in ${chunkTime.toFixed(2)}ms (Load=${loadTime.toFixed(2)}ms, Copy=${copyTime.toFixed(2)}ms, Add=${addTime.toFixed(2)}ms)`);
            } catch (error) {
                console.error(`[PDFManager] Failed to merge PDF chunk ${result.chunkIndex}:`, error);
                throw new Error(`PDF merge failed for chunk ${result.chunkIndex}`);
            }
        }

        // Return merged PDF as bytes
        const saveStart = performance.now();
        const mergedBytes = await mergedPdf.save();
        const saveTime = performance.now() - saveStart;
        console.log(`[PDFManager] Saved merged PDF in ${saveTime.toFixed(2)}ms`);
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
        const startTime = performance.now();
        console.log(`[PDFManager] Starting PDF generation for ${cards.length} cards`);

        // Check cache
        const cardsHash = this.hashCards(cards);
        if (this.cachedPdfUrl && this.cachedCardsHash === cardsHash) {
            console.log(`[PDFManager] Cache hit, returning cached PDF`);
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
            const chunkStart = performance.now();
            const chunks = this.chunkCards(cards);
            const numWorkers = chunks.length;
            const chunkTime = performance.now() - chunkStart;

            console.log(`[PDFManager] Chunked ${cards.length} cards into ${numWorkers} chunks in ${chunkTime.toFixed(2)}ms`);
            chunks.forEach((chunk, i) => {
                console.log(`  - Chunk ${i}: ${chunk.length} cards (${Math.ceil(chunk.length / 8)} pages)`);
            });

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
            const workerCreationStart = performance.now();
            const workerPromises = chunks.map((chunk, chunkIndex) => {
                return new Promise<WorkerChunkResult>((resolve, reject) => {
                    const workerStart = performance.now();
                    const worker = this.createWorker();
                    const workerCreationTime = performance.now() - workerStart;
                    console.log(`[PDFManager] Created Worker ${chunkIndex} in ${workerCreationTime.toFixed(2)}ms`);

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
                                const transferTime = performance.now() - workerStart;
                                console.log(`[PDFManager] Worker ${chunkIndex} completed in ${transferTime.toFixed(2)}ms (data transferred)`);

                                worker.removeEventListener("message", handleMessage);
                                worker.terminate();

                                if ("pdfBytes" in message.payload && "dxfBytes" in message.payload) {
                                    console.log(`[PDFManager] Worker ${chunkIndex} returned ${message.payload.pdfBytes.length} bytes (${message.payload.totalPages} pages)`);
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

                    console.log(`[PDFManager] Dispatching chunk ${chunkIndex} to worker`);
                    worker.postMessage(request);
                });
            });

            const allWorkersCreationTime = performance.now() - workerCreationStart;
            console.log(`[PDFManager] All ${numWorkers} workers created and dispatched in ${allWorkersCreationTime.toFixed(2)}ms`);

            // Wait for all workers to complete
            const workersStart = performance.now();
            console.log(`[PDFManager] Waiting for all workers to complete...`);
            const results = await Promise.all(workerPromises);
            const workersTime = performance.now() - workersStart;
            console.log(`[PDFManager] All workers completed in ${workersTime.toFixed(2)}ms`);

            // Check if request was cancelled during generation
            if (this.currentRequestId !== requestId) {
                throw new Error("Generation cancelled");
            }

            // Merge PDFs on main thread using pdf-lib
            const mergeStart = performance.now();
            console.log(`[PDFManager] Merging ${results.length} PDF chunks...`);
            const mergedPdfBytes = await this.mergePDFs(results);
            const mergeTime = performance.now() - mergeStart;
            console.log(`[PDFManager] PDF merge completed in ${mergeTime.toFixed(2)}ms (${mergedPdfBytes.length} bytes)`);

            const dxfMergeStart = performance.now();
            const mergedDxfBytes = this.mergeDXFs(results);
            const dxfMergeTime = performance.now() - dxfMergeStart;
            console.log(`[PDFManager] DXF merge completed in ${dxfMergeTime.toFixed(2)}ms`);

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

            const totalTime = performance.now() - startTime;
            console.log(`[PDFManager] ✅ PDF generation complete in ${totalTime.toFixed(2)}ms total`);
            console.log(`[PDFManager] Breakdown: Chunk=${chunkTime.toFixed(2)}ms, Workers=${workersTime.toFixed(2)}ms, Merge=${mergeTime.toFixed(2)}ms`);
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
