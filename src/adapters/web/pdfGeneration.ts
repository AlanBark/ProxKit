/**
 * Web-specific PDF generation implementation
 *
 * Uses existing PDFManager with Web Workers
 */

import type { PDFGenerationAdapter, PDFGenerationOptions } from "../types";
import type { CardImage } from "../../types/card";
import { PDFManager } from "../../utils/pdf/PDFManager";

export class WebPDFGenerationAdapter implements PDFGenerationAdapter {
  private pdfManager: PDFManager | null = null;

  async generatePDF(
    cards: (CardImage | null)[],
    options: PDFGenerationOptions,
    onProgress?: (current: number, total: number, percentage: number) => void
  ): Promise<string> {
    // Create or update PDF manager
    if (!this.pdfManager) {
      this.pdfManager = new PDFManager(
        options.pageSettings,
        options.cardWidth,
        options.cardHeight,
        options.outputBleed
      );
    } else {
      this.pdfManager.updatePageSettings(options.pageSettings);
      this.pdfManager.updateCardDimensions(options.cardWidth, options.cardHeight);
    }

    // Set progress callback
    if (onProgress) {
      this.pdfManager.onProgress = onProgress;
    }

    // Generate PDF
    return await this.pdfManager.generatePDF(
      cards,
      options.enableCardBacks,
      options.defaultCardBackUrl || null
    );
  }

  cancelGeneration(): void {
    if (this.pdfManager) {
      this.pdfManager.cancelGeneration();
    }
  }

  invalidateCache(): void {
    if (this.pdfManager) {
      this.pdfManager.invalidateCache();
    }
  }

  isGenerating(): boolean {
    return this.pdfManager?.isGenerating() ?? false;
  }

  getCachedUrl(): string | null {
    return this.pdfManager?.getCachedUrl() ?? null;
  }

  dispose(): void {
    if (this.pdfManager) {
      this.pdfManager.dispose();
      this.pdfManager = null;
    }
  }
}
