import { PDFDocument, rgb } from "pdf-lib";
import type { CardImage, PageSettings } from "../../types/card";
import { PAGE_PRESETS, CARD_DIMENSIONS } from "../../types/card";
import { layoutCards } from "./cardLayout";

/*
  Utility class for incremental PDF generation over the course of a user session
  Manages card images and generates PDFs with proper layout for print-and-cut
*/
export class PDFSession {
  private url: string | null = null;
  private cards: CardImage[] = [];
  private pageSettings: PageSettings;

  constructor(pageSettings: PageSettings = PAGE_PRESETS.A4) {
    this.pageSettings = pageSettings;
  }

  // Convert millimeters to points (PDF unit: 1 point = 1/72 inch)
  private mmToPoints(mm: number): number {
    return (mm / 25.4) * 72;
  }

  // Add a card to the session
  addCard(card: CardImage): void {
    this.cards.push(card);
    this.invalidateURL();
  }

  // Remove a card by ID
  removeCard(cardId: string): void {
    this.cards = this.cards.filter(card => card.id !== cardId);
    this.invalidateURL();
  }

  // Update card bleed
  updateCardBleed(cardId: string, bleed: number): void {
    const card = this.cards.find(c => c.id === cardId);
    if (card) {
      card.bleed = bleed;
      this.invalidateURL();
    }
  }

  // Get all cards
  getCards(): CardImage[] {
    return [...this.cards];
  }

  // Invalidate the current PDF URL when changes are made
  private invalidateURL(): void {
    if (this.url) {
      URL.revokeObjectURL(this.url);
      this.url = null;
    }
  }

  // Generate PDF and return blob URL
  async generatePDF(): Promise<string> {
    if (this.url) {
      return this.url; // Return cached URL if still valid
    }

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();

    // Calculate layout
    const layout = layoutCards(this.cards, this.pageSettings);

    // Render cards
    if (layout.totalPages > 0) {
      for (let pageNum = 0; pageNum < layout.totalPages; pageNum++) {
        const page = pdfDoc.addPage([
          this.mmToPoints(this.pageSettings.width),
          this.mmToPoints(this.pageSettings.height),
        ]);

        const cardsOnPage = layout.positions.filter(pos => pos.page === pageNum);

        for (const position of cardsOnPage) {
          const { card, x, y } = position;

          try {
            // Load and embed the image
            const imageBytes = await this.fetchImageAsBytes(card.imageUrl);
            let image;

            // Try to determine image type and embed accordingly
            try {
              image = await pdfDoc.embedPng(imageBytes);
            } catch {
              try {
                image = await pdfDoc.embedJpg(imageBytes);
              } catch (error) {
                console.error(`Failed to embed image ${card.id}:`, error);
                continue;
              }
            }

            // Calculate dimensions with bleed
            const cardWidth = this.mmToPoints(CARD_DIMENSIONS.width + (2 * card.bleed));
            const cardHeight = this.mmToPoints(CARD_DIMENSIONS.height + (2 * card.bleed));

            // Adjust position to account for bleed
            // Note: pdf-lib uses bottom-left origin, so we need to flip Y
            const adjustedX = this.mmToPoints(x - card.bleed);
            const adjustedY = page.getHeight() - this.mmToPoints(y - card.bleed) - cardHeight;

            // Draw the image
            page.drawImage(image, {
              x: adjustedX,
              y: adjustedY,
              width: cardWidth,
              height: cardHeight,
            });

            // Draw cut line (red rectangle showing actual card boundaries)
            const cutX = this.mmToPoints(x);
            const cutY = page.getHeight() - this.mmToPoints(y) - this.mmToPoints(CARD_DIMENSIONS.height);

            page.drawRectangle({
              x: cutX,
              y: cutY,
              width: this.mmToPoints(CARD_DIMENSIONS.width),
              height: this.mmToPoints(CARD_DIMENSIONS.height),
              borderColor: rgb(1, 0, 0), // Red
              borderWidth: 0.5,
            });
          } catch (error) {
            console.error(`Failed to render card ${card.id}:`, error);
            // Draw placeholder rectangle for failed cards
            const rectX = this.mmToPoints(x);
            const rectY = page.getHeight() - this.mmToPoints(y) - this.mmToPoints(CARD_DIMENSIONS.height);

            page.drawRectangle({
              x: rectX,
              y: rectY,
              width: this.mmToPoints(CARD_DIMENSIONS.width),
              height: this.mmToPoints(CARD_DIMENSIONS.height),
              color: rgb(0.8, 0.8, 0.8),
              borderColor: rgb(0, 0, 0),
              borderWidth: 1,
            });
          }
        }
      }
    }

    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    // Convert Uint8Array to regular array buffer for Blob
    const arrayBuffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
    this.url = URL.createObjectURL(blob);

    return this.url;
  }

  // Helper to fetch image as bytes
  private async fetchImageAsBytes(imageUrl: string): Promise<Uint8Array> {
    // If it's a blob URL, fetch it directly
    if (imageUrl.startsWith('blob:')) {
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }

    // For remote URLs
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  // Clean up resources
  dispose(): void {
    this.invalidateURL();
  }
}
