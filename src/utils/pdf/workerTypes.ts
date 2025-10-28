import type { CardImage, PageSettings } from "../../types/card";

/**
 * Message types for communication between main thread and PDF worker
 */
export const PDFWorkerMessageType = {
    GENERATE_PDF: "GENERATE_PDF",
    GENERATE_PDF_SUCCESS: "GENERATE_PDF_SUCCESS",
    GENERATE_PDF_ERROR: "GENERATE_PDF_ERROR",
    GENERATE_PDF_PROGRESS: "GENERATE_PDF_PROGRESS",
    CANCEL_GENERATION: "CANCEL_GENERATION",
} as const;

/**
 * Request message to generate PDF
 */
export interface GeneratePDFRequest {
    type: typeof PDFWorkerMessageType.GENERATE_PDF;
    payload: {
        cards: (CardImage | null)[]; // null = blank card placeholder
        pageSettings: PageSettings;
        cardWidth: number;
        cardHeight: number;
        requestId: string; // Unique ID to match request/response
    };
}

/**
 * Success response with generated PDF
 */
export interface GeneratePDFSuccess {
    type: typeof PDFWorkerMessageType.GENERATE_PDF_SUCCESS;
    payload: {
        pdfBytes: Uint8Array;
        requestId: string;
        totalPages: number;
    };
}

/**
 * Error response if PDF generation fails
 */
export interface GeneratePDFError {
    type: typeof PDFWorkerMessageType.GENERATE_PDF_ERROR;
    payload: {
        error: string;
        requestId: string;
    };
}

/**
 * Progress update during PDF generation
 */
export interface GeneratePDFProgress {
    type: typeof PDFWorkerMessageType.GENERATE_PDF_PROGRESS;
    payload: {
        requestId: string;
        currentPage: number;
        totalPages: number;
        percentage: number;
    };
}

/**
 * Request to cancel ongoing generation
 */
export interface CancelGenerationRequest {
    type: typeof PDFWorkerMessageType.CANCEL_GENERATION;
    payload: {
        requestId: string;
    };
}

/**
 * Union type of all worker messages
 */
export type PDFWorkerMessage =
    | GeneratePDFRequest
    | GeneratePDFSuccess
    | GeneratePDFError
    | GeneratePDFProgress
    | CancelGenerationRequest;

/**
 * Cached page data for incremental generation
 */
export interface CachedPageData {
    pageNumber: number;
    pdfBytes: Uint8Array;
    cardIds: string[]; // IDs of cards on this page
}
