/**
 * Platform adapter factory
 */

import type {
  ImageUploadAdapter,
  MPCFillImportAdapter,
  PDFGenerationAdapter,
} from "./types";
import { isTauri } from "../utils/platform";

// Web implementations
import { WebImageUploadAdapter } from "./web/imageUpload";
import { WebMPCFillImportAdapter } from "./web/mpcfillImport";
import { WebPDFGenerationAdapter } from "./web/pdfGeneration";

// Tauri implementations
import { TauriImageUploadAdapter } from "./tauri/imageUpload";
import { TauriMPCFillImportAdapter } from "./tauri/mpcfillImport";
import { TauriPDFGenerationAdapter } from "./tauri/pdfGeneration";

/**
 * Create an image upload adapter for the current platform
 */
export function createImageUploadAdapter(): ImageUploadAdapter {
  if (isTauri()) {
    return new TauriImageUploadAdapter();
  }
  return new WebImageUploadAdapter();
}

/**
 * Create an MPCFill import adapter for the current platform
 */
export function createMPCFillImportAdapter(): MPCFillImportAdapter {
  if (isTauri()) {
    return new TauriMPCFillImportAdapter();
  }
  return new WebMPCFillImportAdapter();
}

/**
 * Create a PDF generation adapter for the current platform
 */
export function createPDFGenerationAdapter(): PDFGenerationAdapter {
  if (isTauri()) {
    return new TauriPDFGenerationAdapter();
  }
  return new WebPDFGenerationAdapter();
}

// Re-export types for convenience
export type {
  ImageUploadAdapter,
  MPCFillImportAdapter,
  PDFGenerationAdapter,
  PDFGenerationOptions,
} from "./types";
