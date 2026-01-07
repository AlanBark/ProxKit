import type { CardImage } from "../../types/card";

/**
 * Shared utilities for PDF and DXF generation
 */

/**
 * Grid layout configuration for card placement
 */
export interface GridLayout {
    x: number;          // Starting X position (left edge) in mm
    y: number;          // Starting Y position (top edge) in mm
    cellWidth: number;  // Width of each cell in mm
    cellHeight: number; // Height of each cell in mm
}

/**
 * Card position on the page
 */
export interface CardPosition {
    col: number;
    row: number;
}

/**
 * Card rectangle with position and dimensions
 */
export interface CardRectangle {
    x: number;       // Top-left X position in mm
    y: number;       // Top-left Y position in mm
    width: number;   // Width in mm
    height: number;  // Height in mm
}

/**
 * Cropped card dimensions
 */
export interface CroppedCardDimensions {
    widthMm: number;   // Width after cropping in mm
    heightMm: number;  // Height after cropping in mm
}

/**
 * Constants for card layout
 * TODO support more layout styles, later job
 */
export const CARDS_PER_PAGE = 8;
export const GRID_COLS = 4;
export const GRID_ROWS = 2;

/**
 * Calculate grid layout for 4x2 card arrangement
 * The grid is centered on the page
 *
 * @param pageWidth Page width in mm (landscape orientation)
 * @param pageHeight Page height in mm (landscape orientation)
 * @param cardWidth Card width (including outputBleed) in mm
 * @param cardHeight Card height (including outputBleed) in mm
 * @param gap Gap between cards in mm (default: 0)
 * @returns Grid layout configuration
 */
export function calculateGridLayout(
    pageWidth: number,
    pageHeight: number,
    cardWidth: number,
    cardHeight: number,
    gap: number = 0
): GridLayout {
    // Calculate total grid dimensions including gaps
    // Gaps exist between cards, so we have (GRID_COLS - 1) horizontal gaps
    const totalGridWidth = (cardWidth * GRID_COLS) + (gap * (GRID_COLS - 1));
    const totalGridHeight = (cardHeight * GRID_ROWS) + (gap * (GRID_ROWS - 1));

    // Center the grid on the page
    const startX = (pageWidth - totalGridWidth) / 2;
    const startY = (pageHeight - totalGridHeight) / 2;

    return {
        x: startX,
        y: startY,
        cellWidth: cardWidth + gap,  // Cell width includes the gap after the card
        cellHeight: cardHeight + gap,  // Cell height includes the gap after the card
    };
}

/**
 * Calculate the grid position for a card based on its slot index
 *
 * @param slotIndex Slot index (0-7 for 8-card grid)
 * @returns Card position with column and row
 */
export function calculateCardPosition(slotIndex: number): CardPosition {
    const col = slotIndex % GRID_COLS;
    const row = Math.floor(slotIndex / GRID_COLS);
    return { col, row };
}

/**
 * Calculate the cell position (top-left corner) for a card
 *
 * @param position Card position (col, row)
 * @param gridLayout Grid layout configuration
 * @returns Cell position in mm { x, y }
 */
export function calculateCellPosition(
    position: CardPosition,
    gridLayout: GridLayout
): { x: number; y: number } {
    const cellX = gridLayout.x + position.col * gridLayout.cellWidth;
    const cellY = gridLayout.y + position.row * gridLayout.cellHeight;
    return { x: cellX, y: cellY };
}

/**
 * Calculate the actual dimensions of a cropped card
 * This accounts for the bleed adjustment
 *
 * @param bleed Original bleed amount in mm
 * @param cardWidth Base card width (without bleed) in mm
 * @param cardHeight Base card height (without bleed) in mm
 * @param outputBleed Output bleed amount in mm
 * @returns Cropped card dimensions in mm
 */
export function calculateCroppedDimensions(
    cardWidth: number,
    cardHeight: number,
    outputBleed: number
): CroppedCardDimensions {
    // The cropped card dimensions are: base card size + (2 * outputBleed)
    const widthMm = cardWidth + (2 * outputBleed);
    const heightMm = cardHeight + (2 * outputBleed);

    return {
        widthMm,
        heightMm,
    };
}

/**
 * Calculate the final card rectangle (position + dimensions)
 * The card is centered within its cell
 *
 * @param cellPosition Cell position { x, y } in mm
 * @param cellWidth Cell width in mm
 * @param cellHeight Cell height in mm
 * @param cardWidth Actual card width in mm
 * @param cardHeight Actual card height in mm
 * @returns Card rectangle with position and dimensions
 */
export function calculateCardRectangle(
    cellPosition: { x: number; y: number },
    cellWidth: number,
    cellHeight: number,
    cardWidth: number,
    cardHeight: number
): CardRectangle {
    // Center the card within its cell
    const x = cellPosition.x + (cellWidth - cardWidth) / 2;
    const y = cellPosition.y + (cellHeight - cardHeight) / 2;

    return {
        x,
        y,
        width: cardWidth,
        height: cardHeight,
    };
}

/**
 * Get all card rectangles for a page of cards
 * This is useful for DXF generation to get all cut rectangles at once
 *
 * @param cards Array of cards (null = blank placeholder)
 * @param gridLayout Grid layout configuration
 * @param cardWidth Base card width (without bleed) in mm
 * @param cardHeight Base card height (without bleed) in mm
 * @param outputBleed Output bleed amount in mm
 * @param skipSlots Array of slot indices to skip (0-7)
 * @returns Array of card rectangles with card IDs
 */
export function calculateAllCardRectangles(
    cards: (CardImage | null)[],
    gridLayout: GridLayout,
    cardWidth: number,
    cardHeight: number,
    outputBleed: number,
    skipSlots: number[] = []
): Array<{ card: CardImage; rectangle: CardRectangle }> {
    const rectangles: Array<{ card: CardImage; rectangle: CardRectangle }> = [];

    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];

        // Skip if this slot should be skipped
        if (skipSlots.includes(i % CARDS_PER_PAGE)) continue;

        // Skip null cards (blank placeholders)
        if (!card) continue;

        // Calculate position
        const position = calculateCardPosition(i % CARDS_PER_PAGE);
        const cellPosition = calculateCellPosition(position, gridLayout);

        // Calculate card dimensions
        const croppedDimensions = calculateCroppedDimensions(
            cardWidth,
            cardHeight,
            outputBleed
        );

        // Calculate final rectangle
        const rectangle = calculateCardRectangle(
            cellPosition,
            gridLayout.cellWidth,
            gridLayout.cellHeight,
            croppedDimensions.widthMm,
            croppedDimensions.heightMm
        );

        rectangles.push({ card, rectangle });
    }

    return rectangles;
}

/**
 * Calculate mirrored column position for card backs
 * Used for double-sided printing where backs need to be horizontally mirrored
 *
 * @param originalCol Original column index (0-3)
 * @returns Mirrored column index
 */
export function calculateMirroredColumn(originalCol: number): number {
    return (GRID_COLS - 1) - originalCol;
}
