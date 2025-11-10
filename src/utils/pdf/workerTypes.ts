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
    INIT_PDF: "INIT_PDF",
    INIT_PDF_SUCCESS: "INIT_PDF_SUCCESS",
    INIT_PDF_ERROR: "INIT_PDF_ERROR",
    PLACE_IMAGE: "PLACE_IMAGE",
    PLACE_IMAGE_SUCCESS: "PLACE_IMAGE_SUCCESS",
    PLACE_IMAGE_ERROR: "PLACE_IMAGE_ERROR",
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
 * Success response with generated PDF and DXF cut file
 */
export interface GeneratePDFSuccess {
    type: typeof PDFWorkerMessageType.GENERATE_PDF_SUCCESS;
    payload: {
        pdfBytes: Uint8Array;
        dxfBytes: Uint8Array;
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
    | CancelGenerationRequest
    | InitPDFRequest
    | InitPDFSuccess
    | InitPDFError
    | PlaceImageRequest
    | PlaceImageSuccess
    | PlaceImageError;

/**
 * Cached page data for incremental generation
 */
export interface CachedPageData {
    pageNumber: number;
    pdfBytes: Uint8Array;
    cardIds: string[]; // IDs of cards on this page
}

// ===== New Worker Function Types =====

/**
 * Request to initialize a new PDF document with a page and registration background
 */
export interface InitPDFRequest {
    type: typeof PDFWorkerMessageType.INIT_PDF;
    payload: {
        pageSettings: PageSettings;
        pageNumber: number;
        pdfBytesBase64?: string; // Optional: Base64 encoded existing PDF to add page to
        requestId: string;
    };
}

/**
 * Success response for PDF initialization
 */
export interface InitPDFSuccess {
    type: typeof PDFWorkerMessageType.INIT_PDF_SUCCESS;
    payload: {
        requestId: string;
        pageNumber: number;
        pdfBytesBase64: string; // Base64 encoded PDF document bytes with registration background
    };
}

/**
 * Error response for PDF initialization
 */
export interface InitPDFError {
    type: typeof PDFWorkerMessageType.INIT_PDF_ERROR;
    payload: {
        error: string;
        requestId: string;
    };
}

/**
 * Request to place a card image on the PDF
 */
export interface PlaceImageRequest {
    type: typeof PDFWorkerMessageType.PLACE_IMAGE;
    payload: {
        card: CardImage;
        cardWidth: number;
        cardHeight: number;
        pageNumber: number;
        position: {
            col: number; // Column position (0-3)
            row: number; // Row position (0-1)
        };
        gridLayout: {
            x: number;
            y: number;
            cellWidth: number;
            cellHeight: number;
        };
        pageSettings: PageSettings;
        pdfBytesBase64: string; // Base64 encoded PDF document bytes
        requestId: string;
    };
}

/**
 * Success response for placing image
 */
export interface PlaceImageSuccess {
    type: typeof PDFWorkerMessageType.PLACE_IMAGE_SUCCESS;
    payload: {
        requestId: string;
        cardId: string;
        pageNumber: number;
        pdfBytesBase64: string; // Base64 encoded updated PDF document bytes
        cutPathDXF: string; // DXF cut path for this card
    };
}

/**
 * Error response for placing image
 */
export interface PlaceImageError {
    type: typeof PDFWorkerMessageType.PLACE_IMAGE_ERROR;
    payload: {
        error: string;
        requestId: string;
        cardId?: string;
    };
}
