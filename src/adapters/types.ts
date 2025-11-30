/**
 * Shared types for platform adapters
 */

import type { CardImage } from "../types/card";
import type { MPCFillParseResult } from "../utils/mpcfill/types";

/**
 * Image upload adapter interface
 *
 * Handles platform-specific image file selection and loading
 */
export interface ImageUploadAdapter {
  /**
   * Select one or multiple image files
   *
   * @param multiple - Whether to allow multiple file selection
   * @returns Promise resolving to array of selected files
   */
  selectImages(multiple?: boolean): Promise<File[]>;
}

/**
 * MPCFill XML import adapter interface
 *
 * Handles platform-specific XML file selection and parsing
 */
export interface MPCFillImportAdapter {
  /**
   * Select and parse an MPCFill XML file
   *
   * @returns Promise resolving to parse result and file content
   */
  selectAndParseXML(): Promise<{
    parseResult: MPCFillParseResult;
    xmlContent: string;
  }>;

  /**
   * Download images from Google Drive IDs
   *
   * @param driveIds - Array of Google Drive file IDs
   * @param onProgress - Progress callback (current, total, percentage)
   * @returns Promise resolving to array of downloaded files
   */
  downloadImages(
    driveIds: string[],
    onProgress?: (current: number, total: number, percentage: number) => void
  ): Promise<File[]>;
}

/**
 * PDF generation adapter interface
 *
 * Handles platform-specific PDF generation
 */
export interface PDFGenerationAdapter {
  /**
   * Generate PDF from cards
   *
   * @param cards - Array of card images (null = blank placeholder)
   * @param options - PDF generation options
   * @param onProgress - Progress callback (current, total, percentage)
   * @returns Promise resolving to blob URL of generated PDF
   */
  generatePDF(
    cards: (CardImage | null)[],
    options: PDFGenerationOptions,
    onProgress?: (current: number, total: number, percentage: number) => void
  ): Promise<string>;

  /**
   * Cancel ongoing PDF generation
   */
  cancelGeneration(): void;

  /**
   * Invalidate cached PDF (forces regeneration)
   */
  invalidateCache(): void;

  /**
   * Check if PDF is currently being generated
   */
  isGenerating(): boolean;

  /**
   * Get cached PDF URL if available
   */
  getCachedUrl(): string | null;

  /**
   * Clean up resources
   */
  dispose(): void;
}

/**
 * PDF generation options
 */
export interface PDFGenerationOptions {
  pageSettings: {
    width: number;
    height: number;
    margin: number;
  };
  cardWidth: number;
  cardHeight: number;
  outputBleed: number;
  enableCardBacks?: boolean;
  defaultCardBackUrl?: string | null;
}
