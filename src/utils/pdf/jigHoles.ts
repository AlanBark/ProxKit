import type { PageSettings } from "../../types/card";
import {
    CUT_AREA_INSET,
    GRID_COLS,
    GRID_ROWS,
    REGISTRATION_MARK_EXTENT,
    REGISTRATION_MARK_INSET,
    NO_GRID_OFFSET,
    type GridOffset,
} from "./cardLayoutUtils";

/**
 * The pressing jig: two 3mm pegs with centres 90mm apart, used to line a
 * printed card sheet up with a vinyl sheet before pressing them together.
 */
const PEG_SPACING = 90;

/** Hole size: the 3mm peg plus room for a sheet to drop on without forcing. */
const HOLE_DIAMETER = 3.3;

/**
 * The slot's width, across the line between the pegs: the peg's own size, as
 * the cut comes out with enough room. Any slack here lets the sheet turn about
 * the round hole.
 */
const SLOT_WIDTH = 3;

/**
 * How far the second hole can sit from 90mm either way. Pegs set by hand are
 * never exactly 90mm apart, so that hole is a slot along the line between the
 * pegs: the round hole fixes where the sheet sits, and the slot stops it
 * turning without having to match the spacing exactly.
 */
const SLOT_PLAY = 1;

/** Hole centres sit this far in from the sheet's left edge. */
const EDGE_OFFSET = 15;

export interface JigHoleLayout {
    diameter: number;
    round: { x: number; y: number };
    /** Runs along y, towards and away from the round hole. */
    slot: { x: number; y: number; width: number; length: number };
}

/**
 * Where the holes go on a sheet, in mm, landscape like the rest of the layout:
 * both down the left margin, centred top to bottom.
 */
export function jigHoleLayout(page: Pick<PageSettings, "width" | "height">): JigHoleLayout {
    // Sheets print landscape, so the page's width is the sheet's height.
    const middle = page.width / 2;

    return {
        diameter: HOLE_DIAMETER,
        round: { x: EDGE_OFFSET, y: middle - PEG_SPACING / 2 },
        slot: {
            x: EDGE_OFFSET,
            y: middle + PEG_SPACING / 2,
            width: SLOT_WIDTH,
            length: SLOT_WIDTH + 2 * SLOT_PLAY,
        },
    };
}

/** The printed grid's size, in mm: the cards, the gaps, and the outer bleed. */
function gridSize(cardWidth: number, cardHeight: number, outputBleed: number, cardSpacing: number) {
    return {
        width: GRID_COLS * cardWidth + (GRID_COLS - 1) * cardSpacing + 2 * outputBleed,
        height: GRID_ROWS * cardHeight + (GRID_ROWS - 1) * cardSpacing + 2 * outputBleed,
    };
}

/**
 * Whether a grid with these margins stays inside the marks' inset and out of
 * the three corners that carry a mark: top-left, top-right and bottom-left.
 * The small tolerance lets a grid placed exactly on the inset count as inside.
 */
function clearOfMarks(margins: { left: number; top: number; right: number; bottom: number }): boolean {
    const { left, top, right, bottom } = margins;
    const tolerance = 1e-6;
    const clear = (a: number, b: number) =>
        a >= REGISTRATION_MARK_EXTENT - tolerance || b >= REGISTRATION_MARK_EXTENT - tolerance;

    return Math.min(left, top, right, bottom) >= REGISTRATION_MARK_INSET - tolerance
        && clear(left, top)
        && clear(right, top)
        && clear(left, bottom);
}

/**
 * How far the card grid moves from the centre of the sheet when the jig holes
 * are on, in mm: as far right as Silhouette Studio will still cut, to give the
 * holes on the left more room.
 *
 * Out that far the grid would run into the top-right mark, so it also drops
 * into the bottom-right corner, the one without a mark, when the sheet has the
 * height for it. Otherwise it stays centred top to bottom and stops short of
 * the top-right mark. It never moves left of centre.
 */
export function jigGridOffset(
    page: Pick<PageSettings, "width" | "height">,
    cardWidth: number,
    cardHeight: number,
    outputBleed: number,
    cardSpacing: number
): GridOffset {
    const sheetWidth = page.height;
    const sheetHeight = page.width;
    const grid = gridSize(cardWidth, cardHeight, outputBleed, cardSpacing);
    const centred = { x: (sheetWidth - grid.width) / 2, y: (sheetHeight - grid.height) / 2 };

    // The closest the print can come to an edge with its cut line still in
    // Studio's cutting area: the cut sits the bleed inside the print.
    const cutEdge = CUT_AREA_INSET - outputBleed;

    // Right and bottom margins to try, most room for the holes first. A null
    // bottom keeps the grid centred top to bottom.
    const candidates = [
        { right: cutEdge, bottom: cutEdge },
        { right: cutEdge, bottom: REGISTRATION_MARK_EXTENT },
        { right: REGISTRATION_MARK_EXTENT, bottom: null },
    ];

    for (const { right, bottom } of candidates) {
        const x = sheetWidth - right - grid.width;
        const y = bottom === null ? centred.y : sheetHeight - bottom - grid.height;
        const margins = {
            left: x,
            top: y,
            right,
            bottom: sheetHeight - y - grid.height,
        };

        if (x >= centred.x && clearOfMarks(margins)) {
            return { x: x - centred.x, y: y - centred.y };
        }
    }

    return NO_GRID_OFFSET;
}

/**
 * Whether the holes clear the cards and the registration marks.
 *
 * The cards are measured to the edge of their printed bleed, with the grid
 * where jigGridOffset puts it. A wider card or more spacing pushes the grid
 * towards the holes, and on Letter the side margin is too narrow for them at
 * all.
 */
export function jigHolesFit(
    page: Pick<PageSettings, "width" | "height">,
    cardWidth: number,
    cardHeight: number,
    outputBleed: number,
    cardSpacing: number
): boolean {
    const { diameter, round, slot } = jigHoleLayout(page);
    const radius = Math.max(diameter, slot.width) / 2;

    const sheetWidth = page.height;
    const sheetHeight = page.width;
    const grid = gridSize(cardWidth, cardHeight, outputBleed, cardSpacing);
    const offset = jigGridOffset(page, cardWidth, cardHeight, outputBleed, cardSpacing);
    const gridLeft = (sheetWidth - grid.width) / 2 + offset.x;

    const clearOfCards = round.x + radius <= gridLeft;
    const clearOfEdge = round.x - radius >= REGISTRATION_MARK_INSET;
    // The corner marks at the top-left and bottom-left.
    const clearOfCornerMarks =
        round.y - diameter / 2 >= REGISTRATION_MARK_EXTENT &&
        slot.y + slot.length / 2 <= sheetHeight - REGISTRATION_MARK_EXTENT;

    return clearOfCards && clearOfEdge && clearOfCornerMarks;
}
