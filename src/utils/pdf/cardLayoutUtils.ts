import type { CardImage, PageSettings } from "../../types/card";

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
 * How far the grid sits from the centre of the sheet, in mm. Positive x is
 * right, positive y is down.
 */
export interface GridOffset {
    x: number;
    y: number;
}

export const NO_GRID_OFFSET: GridOffset = { x: 0, y: 0 };

/**
 * The offset for the back of a sheet. Backs are mirrored left to right so they
 * land behind their fronts once the sheet is turned over, so the grid's
 * sideways shift is mirrored with them.
 */
export function mirrorGridOffset(offset: GridOffset): GridOffset {
    return { x: -offset.x, y: offset.y };
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
 * Where the registration marks sit, in mm in from the sheet's edges.
 *
 * Measured from assets/a4_registration.jpg and letter_registration.jpg, which
 * agree: three corners carry a mark running from 9.4mm to 17.8mm in from both
 * edges.
 */
export const REGISTRATION_MARK_INSET = 9.4;
export const REGISTRATION_MARK_EXTENT = 17.8;

/**
 * How far in from the sheet's edges Silhouette Studio will cut, in mm, with
 * the registration marks on. Measured to the cut line, not the print.
 *
 * Studio skips cuts in the hatched border around the marks. A cut 9.9mm in,
 * on the line of the marks, was skipped in testing; the standard Letter layout
 * cuts 12.2mm in from its sides and is cut, so this keeps to that.
 */
export const CUT_AREA_INSET = 12.2;

export interface CardSpacingRange {
    min: number;
    max: number;
}

/**
 * The card spacings a page can take, in mm.
 *
 * Spacing is the distance between neighbouring cards' cut lines. Each card
 * prints `outputBleed` into that gap from both sides, so the minimum is twice
 * the bleed - any less and one card's bleed would print over the next card's
 * artwork. At the minimum the bleeds just meet.
 *
 * The maximum is the widest grid that stays clear of the registration marks:
 * inside their inset on every side, and out of the corner squares they occupy.
 * It is rounded down to the 0.1mm the setting steps in, so the largest value
 * offered is itself safe. It can fall below the minimum when the cards are
 * too large for the page at all.
 */
export function cardSpacingRange(
    page: Pick<PageSettings, "width" | "height">,
    cardWidth: number,
    cardHeight: number,
    outputBleed: number
): CardSpacingRange {
    // Sheets print landscape, so the page's height runs across the grid.
    const sheetWidth = page.height;
    const sheetHeight = page.width;

    // The largest spacing that keeps the grid `margin` from the sheet's edges.
    const across = (margin: number) =>
        (sheetWidth - 2 * margin - GRID_COLS * cardWidth - 2 * outputBleed) / (GRID_COLS - 1);
    const down = (margin: number) =>
        (sheetHeight - 2 * margin - GRID_ROWS * cardHeight - 2 * outputBleed) / (GRID_ROWS - 1);

    const max = Math.min(
        across(REGISTRATION_MARK_INSET),
        down(REGISTRATION_MARK_INSET),
        // The grid's corners miss the corner marks if it stays clear of them
        // in either direction.
        Math.max(across(REGISTRATION_MARK_EXTENT), down(REGISTRATION_MARK_EXTENT))
    );

    return {
        min: 2 * outputBleed,
        // The epsilon keeps 2.8 from flooring to 2.7 through float error.
        max: Math.floor(max * 10 + 1e-6) / 10,
    };
}

/**
 * The spacing to lay out with: `requested`, held inside what the page allows.
 *
 * Never below the minimum, even when nothing fits - overlapping the marks is
 * an existing problem with the card size, but overlapping artwork would be a
 * new one.
 */
export function clampCardSpacing(requested: number, { min, max }: CardSpacingRange): number {
    if (!Number.isFinite(requested)) return min;
    return Math.max(min, Math.min(requested, max));
}

/**
 * One position on a page.
 *
 * `skipped` and `empty` both render nothing, but they are not the same thing:
 * a slot is skipped because the user turned it off, and empty because the card
 * list ran out. The preview draws them differently.
 */
export type Slot =
    | { kind: "card"; card: CardImage; cardId: string; globalIndex: number }
    | { kind: "skipped" }
    | { kind: "empty" };

/**
 * Assigns cards to page slots.
 *
 * This is the single source of truth for where a card ends up. It previously
 * existed three times - once for the preview, once for PDF export and once for
 * DXF - which meant the preview and the output agreed only by coincidence.
 *
 * Every returned page is exactly CARDS_PER_PAGE long, so callers can index by
 * slot without bounds checks.
 */
export function layoutPages(
    cardOrder: string[],
    cardMap: Map<string, CardImage>,
    skipSlots: Set<number>
): Slot[][] {
    const skipped = [...skipSlots].filter((slot) => slot >= 0 && slot < CARDS_PER_PAGE);
    const availablePerPage = CARDS_PER_PAGE - skipped.length;

    if (availablePerPage <= 0 || cardOrder.length === 0) {
        return [];
    }

    const totalPages = Math.ceil(cardOrder.length / availablePerPage);
    const pages: Slot[][] = [];
    let cursor = 0;

    for (let page = 0; page < totalPages; page++) {
        const slots: Slot[] = [];

        for (let slot = 0; slot < CARDS_PER_PAGE; slot++) {
            if (skipped.includes(slot)) {
                slots.push({ kind: "skipped" });
                continue;
            }

            const cardId = cardOrder[cursor];
            if (cardId === undefined) {
                slots.push({ kind: "empty" });
                continue;
            }

            const globalIndex = cursor;
            cursor++;

            const card = cardMap.get(cardId);
            slots.push(card ? { kind: "card", card, cardId, globalIndex } : { kind: "empty" });
        }

        pages.push(slots);
    }

    return pages;
}

/**
 * Whether a page's cards need a back page printed behind them.
 *
 * With `groupByCardBacks` off this is just `enableCardBacks` - a back page
 * follows every front page, as it always has. With it on, only a page holding
 * at least one card with its own back gets one, which is what splits a long
 * order into a short double-sided run and a longer single-sided one. The
 * grouping sort is what makes that run contiguous rather than scattered.
 *
 * Note that a card's own back is what counts, not the order's shared back: if
 * the shared back decided this, every page would need one and nothing would be
 * saved. The shared back still fills the other slots on the pages that are
 * being printed double-sided anyway.
 *
 * Mirrored in the Rust pipeline - see page_needs_back_page in
 * commands/cardlist_generation.rs.
 */
export function pageNeedsBackPage(
    pageCards: (CardImage | null)[],
    enableCardBacks: boolean,
    groupByCardBacks: boolean
): boolean {
    if (!enableCardBacks) return false;
    if (!groupByCardBacks) return true;
    return pageCards.some((card) => card?.cardBack !== undefined);
}

/**
 * Collapses page numbers into ranges: [1,2,3,7] becomes "1-3, 7".
 *
 * Expects ascending input. Meant for telling someone which pages to type into a
 * print dialog, which is why it reads as ranges rather than a list.
 */
export function formatPageRanges(pageNumbers: number[]): string {
    const ranges: string[] = [];
    let start: number | null = null;
    let previous: number | null = null;

    const flush = () => {
        if (start === null || previous === null) return;
        ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
    };

    for (const page of pageNumbers) {
        if (previous !== null && page === previous + 1) {
            previous = page;
            continue;
        }
        flush();
        start = page;
        previous = page;
    }
    flush();

    return ranges.join(", ");
}

/**
 * Splits a run of pages into the printed page numbers that need duplex and
 * those that do not.
 *
 * A page that needs a back takes two sheets' worth of output, so the printed
 * numbering drifts from the page numbering as soon as some pages are skipped.
 * This resolves that drift once, here, rather than asking the user to work it
 * out from a PDF.
 */
export function splitDuplexPages(needsBack: boolean[]): {
    duplex: number[];
    single: number[];
} {
    const duplex: number[] = [];
    const single: number[] = [];
    let printed = 1;

    for (const isDuplex of needsBack) {
        if (isDuplex) {
            duplex.push(printed, printed + 1);
            printed += 2;
        } else {
            single.push(printed);
            printed += 1;
        }
    }

    return { duplex, single };
}

/**
 * Flattens a layout for the generators, which want one array of cards and gaps.
 *
 * Skipped and empty slots both become null: to a renderer they are simply
 * positions with nothing in them.
 */
export function slotsToCards(pages: Slot[][]): (CardImage | null)[] {
    return pages.flatMap((page) => page.map((slot) => (slot.kind === "card" ? slot.card : null)));
}

/**
 * Calculate grid layout for 4x2 card arrangement
 * The grid is centered on the page, then moved by `offset`
 *
 * @param pageWidth Page width in mm (landscape orientation)
 * @param pageHeight Page height in mm (landscape orientation)
 * @param cardWidth Card width (including outputBleed) in mm
 * @param cardHeight Card height (including outputBleed) in mm
 * @param gap Gap between cards in mm (default: 0)
 * @param offset How far to move the grid from centre in mm (default: none)
 * @returns Grid layout configuration
 */
export function calculateGridLayout(
    pageWidth: number,
    pageHeight: number,
    cardWidth: number,
    cardHeight: number,
    gap: number = 0,
    offset: GridOffset = NO_GRID_OFFSET
): GridLayout {
    // Calculate total grid dimensions including gaps
    // Gaps exist between cards, so we have (GRID_COLS - 1) horizontal gaps
    const totalGridWidth = (cardWidth * GRID_COLS) + (gap * (GRID_COLS - 1));
    const totalGridHeight = (cardHeight * GRID_ROWS) + (gap * (GRID_ROWS - 1));

    // Center the grid on the page
    const startX = (pageWidth - totalGridWidth) / 2 + offset.x;
    const startY = (pageHeight - totalGridHeight) / 2 + offset.y;

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
