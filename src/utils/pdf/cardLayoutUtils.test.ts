import { describe, it, expect } from "vitest";
import {
    layoutPages,
    slotsToCards,
    pageNeedsBackPage,
    formatPageRanges,
    splitDuplexPages,
    CARDS_PER_PAGE,
} from "./cardLayoutUtils";
import type { CardImage } from "../../types/card";

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
