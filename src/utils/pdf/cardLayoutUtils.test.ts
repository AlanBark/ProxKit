import { describe, it, expect } from "vitest";
import {
    layoutPages,
    slotsToCards,
    pageNeedsBackPage,
    formatPageRanges,
    splitDuplexPages,
    cardSpacingRange,
    clampCardSpacing,
    calculateGridLayout,
    calculateAllCardRectangles,
    calculateMirroredColumn,
    mirrorGridOffset,
    CARDS_PER_PAGE,
    GRID_COLS,
} from "./cardLayoutUtils";
import { CARD_DIMENSIONS, type CardImage } from "../../types/card";

function makeCard(id: string): CardImage {
    return {
        id,
        image: { kind: "path", path: `/cards/${id}.png` },
        bleed: 3,
        useCustomBleed: false,
        cardBackBleed: 3,
        useCustomCardBackBleed: false,
    };
}

/** Builds a cardOrder plus matching map for `count` distinct cards. */
function makeCards(count: number) {
    const cards = Array.from({ length: count }, (_, i) => makeCard(`c${i}`));
    return {
        cardOrder: cards.map((c) => c.id),
        cardMap: new Map(cards.map((c) => [c.id, c])),
    };
}

describe("layoutPages", () => {
    it("returns nothing for an empty card list", () => {
        expect(layoutPages([], new Map(), new Set())).toEqual([]);
    });

    it("always returns full pages so slots can be indexed directly", () => {
        const { cardOrder, cardMap } = makeCards(3);
        const pages = layoutPages(cardOrder, cardMap, new Set());
        expect(pages).toHaveLength(1);
        expect(pages[0]).toHaveLength(CARDS_PER_PAGE);
    });

    it("fills a page in order and marks the remainder empty", () => {
        const { cardOrder, cardMap } = makeCards(3);
        const [page] = layoutPages(cardOrder, cardMap, new Set());
        expect(page.map((s) => s.kind)).toEqual([
            "card", "card", "card", "empty", "empty", "empty", "empty", "empty",
        ]);
    });

    it("keeps a skipped slot empty and flows cards around it", () => {
        const { cardOrder, cardMap } = makeCards(3);
        const [page] = layoutPages(cardOrder, cardMap, new Set([1]));
        expect(page.map((s) => s.kind)).toEqual([
            "card", "skipped", "card", "card", "empty", "empty", "empty", "empty",
        ]);
        // The skip must not consume a card.
        expect(page[0]).toMatchObject({ cardId: "c0" });
        expect(page[2]).toMatchObject({ cardId: "c1" });
        expect(page[3]).toMatchObject({ cardId: "c2" });
    });

    it("paginates by the number of usable slots, not by eight", () => {
        const { cardOrder, cardMap } = makeCards(10);
        // One slot skipped leaves seven usable per page.
        const pages = layoutPages(cardOrder, cardMap, new Set([0]));
        expect(pages).toHaveLength(2);
        expect(pages[1][1]).toMatchObject({ cardId: "c7" });
    });

    it("repeats a skipped slot on every page", () => {
        const { cardOrder, cardMap } = makeCards(10);
        const pages = layoutPages(cardOrder, cardMap, new Set([0]));
        expect(pages[0][0].kind).toBe("skipped");
        expect(pages[1][0].kind).toBe("skipped");
    });

    it("numbers cards by their position in the order, across pages", () => {
        const { cardOrder, cardMap } = makeCards(10);
        const pages = layoutPages(cardOrder, cardMap, new Set());
        const indices = pages
            .flat()
            .filter((s) => s.kind === "card")
            .map((s) => (s.kind === "card" ? s.globalIndex : -1));
        expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it("gives duplicates of one card distinct positions", () => {
        const card = makeCard("dup");
        const cardMap = new Map([[card.id, card]]);
        const [page] = layoutPages(["dup", "dup"], cardMap, new Set());

        expect(page[0]).toMatchObject({ cardId: "dup", globalIndex: 0 });
        expect(page[1]).toMatchObject({ cardId: "dup", globalIndex: 1 });
    });

    it("returns nothing when every slot is skipped", () => {
        const { cardOrder, cardMap } = makeCards(3);
        const allSkipped = new Set(Array.from({ length: CARDS_PER_PAGE }, (_, i) => i));
        expect(layoutPages(cardOrder, cardMap, allSkipped)).toEqual([]);
    });
});

describe("slotsToCards", () => {
    it("turns skipped and empty slots alike into gaps", () => {
        const { cardOrder, cardMap } = makeCards(2);
        const flat = slotsToCards(layoutPages(cardOrder, cardMap, new Set([1])));

        expect(flat).toHaveLength(CARDS_PER_PAGE);
        expect(flat[0]?.id).toBe("c0");
        expect(flat[1]).toBeNull();  // skipped
        expect(flat[2]?.id).toBe("c1");
        expect(flat[3]).toBeNull();  // empty
    });

    it("produces a whole number of pages for the generators to chunk", () => {
        const { cardOrder, cardMap } = makeCards(10);
        const flat = slotsToCards(layoutPages(cardOrder, cardMap, new Set()));
        expect(flat.length % CARDS_PER_PAGE).toBe(0);
        expect(flat.filter(Boolean)).toHaveLength(10);
    });
});

/** A card carrying its own back image, as a double-faced card would. */
function makeCardWithBack(id: string): CardImage {
    return { ...makeCard(id), cardBack: { kind: "path", path: `/backs/${id}.png` } };
}

describe("pageNeedsBackPage", () => {
    it("never needs one when card backs are switched off", () => {
        expect(pageNeedsBackPage([makeCardWithBack("a")], false, true)).toBe(false);
        expect(pageNeedsBackPage([makeCardWithBack("a")], false, false)).toBe(false);
    });

    it("needs one on every page when grouping is off", () => {
        expect(pageNeedsBackPage([makeCard("a")], true, false)).toBe(true);
        expect(pageNeedsBackPage([null, null], true, false)).toBe(true);
    });

    it("needs one only where a card brings its own back", () => {
        expect(pageNeedsBackPage([makeCard("a"), makeCard("b")], true, true)).toBe(false);
        expect(pageNeedsBackPage([makeCard("a"), makeCardWithBack("b")], true, true)).toBe(true);
    });

    it("ignores empty slots rather than treating them as backless cards", () => {
        expect(pageNeedsBackPage([null, makeCardWithBack("a"), null], true, true)).toBe(true);
        expect(pageNeedsBackPage([null, null], true, true)).toBe(false);
    });
});

describe("splitDuplexPages", () => {
    it("counts a duplex page as two printed pages", () => {
        expect(splitDuplexPages([true, true])).toEqual({ duplex: [1, 2, 3, 4], single: [] });
    });

    it("shifts later page numbers by the backs printed before them", () => {
        // Two duplex pages occupy printed pages 1-4, so the first single-sided
        // page is 5 rather than 3.
        expect(splitDuplexPages([true, true, false, false])).toEqual({
            duplex: [1, 2, 3, 4],
            single: [5, 6],
        });
    });

    it("handles a single-sided page appearing first", () => {
        expect(splitDuplexPages([false, true])).toEqual({ duplex: [2, 3], single: [1] });
    });

    it("returns nothing for no pages", () => {
        expect(splitDuplexPages([])).toEqual({ duplex: [], single: [] });
    });
});

describe("formatPageRanges", () => {
    it("collapses consecutive pages into a range", () => {
        expect(formatPageRanges([1, 2, 3, 4])).toBe("1-4");
    });

    it("keeps separate runs apart", () => {
        expect(formatPageRanges([1, 2, 3, 7, 9, 10])).toBe("1-3, 7, 9-10");
    });

    it("renders a lone page without a dash", () => {
        expect(formatPageRanges([5])).toBe("5");
    });

    it("is empty for no pages", () => {
        expect(formatPageRanges([])).toBe("");
    });
});

describe("cardSpacingRange", () => {
    const A4 = { width: 210, height: 297 };
    const LETTER = { width: 215.9, height: 279.4 };

    it("starts at twice the output bleed, where neighbouring bleeds meet", () => {
        expect(cardSpacingRange(A4, 63, 88, 0.5).min).toBe(1);
        expect(cardSpacingRange(A4, 63, 88, 1).min).toBe(2);
    });

    it("stops where the grid would reach the registration marks", () => {
        // A4 runs into the corner marks first; Letter into the marks' inset
        // along its sides.
        expect(cardSpacingRange(A4, 63, 88, 0.5).max).toBe(2.8);
        expect(cardSpacingRange(LETTER, 63, 88, 0.5).max).toBe(2.5);
    });
});

describe("clampCardSpacing", () => {
    const range = { min: 1, max: 2.5 };

    it("leaves a spacing that fits alone", () => {
        expect(clampCardSpacing(1.7, range)).toBe(1.7);
    });

    it("holds a spacing to what the page allows", () => {
        expect(clampCardSpacing(0.2, range)).toBe(1);
        expect(clampCardSpacing(4, range)).toBe(2.5);
    });

    it("keeps the minimum when nothing fits, so bleed never covers artwork", () => {
        expect(clampCardSpacing(1.5, { min: 1, max: 0.3 })).toBe(1);
    });

    it("falls back to the minimum for a value that is not a number", () => {
        expect(clampCardSpacing(Number.NaN, range)).toBe(1);
    });
});

describe("grid layout with card spacing", () => {
    const cards = Array.from({ length: CARDS_PER_PAGE }, (_, i) => makeCard(`c${i}`));

    it("puts neighbouring cut lines exactly the spacing apart, centred on the page", () => {
        const spacing = 2.5;
        const layout = calculateGridLayout(297, 210, 63 + spacing, 88 + spacing);
        const rects = calculateAllCardRectangles(cards, layout, 63, 88, 0).map((r) => r.rectangle);

        expect(rects[1].x - (rects[0].x + 63)).toBeCloseTo(spacing);
        expect(rects[4].y - (rects[0].y + 88)).toBeCloseTo(spacing);
        expect(rects[0].x).toBeCloseTo(297 - (rects[3].x + 63));
        expect(rects[0].y).toBeCloseTo(210 - (rects[4].y + 88));
    });

    it("reproduces the old fixed layout at the default spacing", () => {
        // Before spacing was a setting, each cell was the card plus the output
        // bleed on both sides.
        const before = calculateGridLayout(297, 210, 63 + 2 * 0.5, 88 + 2 * 0.5);
        const now = calculateGridLayout(
            297, 210, 63 + CARD_DIMENSIONS.cardSpacing, 88 + CARD_DIMENSIONS.cardSpacing
        );
        expect(now).toEqual(before);
    });
});

describe("grid layout moved off centre", () => {
    const offset = { x: 11.1, y: 6.6 };

    it("moves the whole grid by the offset", () => {
        const centred = calculateGridLayout(297, 210, 64, 89);
        const moved = calculateGridLayout(297, 210, 64, 89, 0, offset);

        expect(moved.x - centred.x).toBeCloseTo(11.1, 6);
        expect(moved.y - centred.y).toBeCloseTo(6.6, 6);
    });

    it("lands each back exactly behind its front once the sheet is turned over", () => {
        // Turned over left to right, x becomes 297 - x. The backs mirror their
        // columns, and their grid takes the mirrored offset.
        const front = calculateGridLayout(297, 210, 64, 89, 0, offset);
        const back = calculateGridLayout(297, 210, 64, 89, 0, mirrorGridOffset(offset));

        for (let col = 0; col < GRID_COLS; col++) {
            const frontLeft = front.x + col * front.cellWidth;
            const backLeft = back.x + calculateMirroredColumn(col) * back.cellWidth;
            expect(297 - (backLeft + back.cellWidth)).toBeCloseTo(frontLeft, 6);
        }
        expect(back.y).toBe(front.y);
    });
});
