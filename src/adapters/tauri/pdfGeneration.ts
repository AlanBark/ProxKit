/**
 * Tauri-specific PDF generation implementation
 *
 * Uses Rust backend for high-performance PDF generation
 */

import type { PDFGenerationAdapter, PDFGenerationOptions } from "../types";
import type { CardImage } from "../../types/card";

export class TauriPDFGenerationAdapter implements PDFGenerationAdapter {
  private generating: boolean = false;
  private cachedUrl: string | null = null;

  async generatePDF(
    cards: (CardImage | null)[],
    options: PDFGenerationOptions,
    onProgress?: (current: number, total: number, percentage: number) => void
  ): Promise<string> {
    // TODO: Implement using Tauri commands
    //
    // Example approach:
    // 1. Invoke Tauri command with card data
    // 2. Rust backend generates PDF using a library like printpdf or pdf_writer
    // 3. Return file path or save to user-selected location
    //
    // const { invoke } = await import('@tauri-apps/api/core');
    // const pdfPath = await invoke('generate_pdf', {
    //   cards: cards.map(card => ({
    //     imageUrl: card?.imageUrl,
    //     bleed: card?.bleed,
    //   })),
    //   options
    // });
    //
    // Use Tauri's save dialog to let user choose location
    // const { save } = await import('@tauri-apps/plugin-dialog');
    // const savePath = await save({
    //   filters: [{
    //     name: 'PDF',
    //     extensions: ['pdf']
    //   }]
    // });

    throw new Error("Tauri PDF generation not yet implemented");
  }

  cancelGeneration(): void {
    // TODO: Implement cancellation via Tauri
    this.generating = false;
  }

  invalidateCache(): void {
    if (this.cachedUrl) {
      URL.revokeObjectURL(this.cachedUrl);
      this.cachedUrl = null;
    }
  }

  isGenerating(): boolean {
    return this.generating;
  }

  getCachedUrl(): string | null {
    return this.cachedUrl;
  }

  dispose(): void {
    this.invalidateCache();
  }
}
