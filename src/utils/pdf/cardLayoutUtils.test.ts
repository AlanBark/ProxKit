import { describe, it, expect } from "vitest";
import { layoutPages, slotsToCards, CARDS_PER_PAGE } from "./cardLayoutUtils";
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
