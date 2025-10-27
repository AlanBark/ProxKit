import type { CardImage, PageSettings } from "../../types/card";
import { CARD_DIMENSIONS } from "../../types/card";

export interface CardPosition {
    card: CardImage;
    x: number; // position in mm
    y: number; // position in mm
    page: number; // page number (0-indexed)
}

export interface LayoutResult {
    positions: CardPosition[];
    totalPages: number;
}

/**
 * Calculate optimal layout for cards on pages
 * Returns positions for each card
 */
export function layoutCards(
    cards: CardImage[],
    pageSettings: PageSettings,
    spacing: number = 2 // spacing between cards in mm
): LayoutResult {
    const positions: CardPosition[] = [];

    // Calculate usable area
    const usableWidth = pageSettings.width - (2 * pageSettings.margin);
    const usableHeight = pageSettings.height - (2 * pageSettings.margin);

    // Calculate how many cards fit per row and column
    const cardWidthWithSpacing = CARD_DIMENSIONS.width + spacing;
    const cardHeightWithSpacing = CARD_DIMENSIONS.height + spacing;

    const cardsPerRow = Math.floor((usableWidth + spacing) / cardWidthWithSpacing);
    const cardsPerColumn = Math.floor((usableHeight + spacing) / cardHeightWithSpacing);
    const cardsPerPage = cardsPerRow * cardsPerColumn;

    if (cardsPerPage === 0) {
        throw new Error("Page size too small to fit any cards");
    }

    // Calculate centering offset to center the grid on the page
    const gridWidth = (cardsPerRow * cardWidthWithSpacing) - spacing;
    const gridHeight = (cardsPerColumn * cardHeightWithSpacing) - spacing;
    const offsetX = pageSettings.margin + (usableWidth - gridWidth) / 2;
    const offsetY = pageSettings.margin + (usableHeight - gridHeight) / 2;

    // Position each card
    cards.forEach((card, index) => {
        const page = Math.floor(index / cardsPerPage);
        const positionOnPage = index % cardsPerPage;
        const row = Math.floor(positionOnPage / cardsPerRow);
        const col = positionOnPage % cardsPerRow;

        positions.push({
            card,
            x: offsetX + (col * cardWidthWithSpacing),
            y: offsetY + (row * cardHeightWithSpacing),
            page,
        });
    });

    const totalPages = cards.length > 0 ? Math.ceil(cards.length / cardsPerPage) : 0;

    return { positions, totalPages };
}
