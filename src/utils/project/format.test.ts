import { describe, it, expect } from "vitest";
import {
    PROJECT_FORMAT,
    PROJECT_VERSION,
    parseProject,
    serializeProject,
    unsaveableCards,
    type ProjectSettings,
    type SerializeInput,
} from "./format";
import type { CardImage } from "../../types/card";

const settings: ProjectSettings = {
    pageSize: "A4",
    cardWidth: 63,
    cardHeight: 88,
    defaultBleed: 3,
    defaultCardBackBleed: 3,
    outputBleed: 0.5,
    enableCardBacks: false,
    groupByCardBacks: false,
    showAllCardBacks: false,
    skipSlots: [3],
};

function libraryCard(id: string, name: string, driveId?: string): CardImage {
    return {
        id,
        name,
        image: { kind: "path", path: `C:/lib/${name} (${driveId ?? "x"}).png`, ...(driveId ? { driveId } : {}) },
        bleed: 3,
        useCustomBleed: false,
        cardBackBleed: 3,
        useCustomCardBackBleed: false,
    };
}

function input(cards: CardImage[], order?: string[]): SerializeInput {
    return {
        settings,
        defaultCardBack: null,
        cardMap: new Map(cards.map((c) => [c.id, c])),
        cardOrder: order ?? cards.map((c) => c.id),
    };
}

describe("serializeProject", () => {
    it("round-trips through JSON", () => {
        const file = serializeProject(input([libraryCard("a", "Black Lotus", "1LrV")]));
        const parsed = parseProject(JSON.stringify(file));

        expect(parsed.format).toBe(PROJECT_FORMAT);
        expect(parsed.version).toBe(PROJECT_VERSION);
        expect(parsed.settings).toEqual(settings);
        expect(parsed.cards.a.name).toBe("Black Lotus");
    });

    it("keeps the drive id, which is what lets a lost image be recovered", () => {
        const file = serializeProject(input([libraryCard("a", "Black Lotus", "1LrV")]));
        expect(file.cards.a.front?.driveId).toBe("1LrV");
        expect(file.cards.a.front?.fileName).toBe("Black Lotus (1LrV).png");
    });

    it("omits the drive id for images picked off disk", () => {
        const card: CardImage = {
            ...libraryCard("a", "Custom"),
            image: { kind: "path", path: "D:/art/token.png" },
        };
        const file = serializeProject(input([card]));
        expect(file.cards.a.front).toEqual({ path: "D:/art/token.png", fileName: "token.png" });
        expect(file.cards.a.front).not.toHaveProperty("driveId");
    });

    // Duplicates are the same card, not copies, so they must not be duplicated
    // in `cards` - only in `order`.
    it("stores a duplicated card once but keeps every position", () => {
        const card = libraryCard("a", "Lightning Bolt", "1abc");
        const file = serializeProject(input([card], ["a", "a", "a"]));

        expect(Object.keys(file.cards)).toEqual(["a"]);
        expect(file.order).toEqual(["a", "a", "a"]);
    });

    it("drops order entries whose card is gone, so the two cannot disagree", () => {
        const file = serializeProject(input([libraryCard("a", "Kept", "1a")], ["a", "ghost", "a"]));
        expect(file.order).toEqual(["a", "a"]);
        expect(Object.keys(file.cards)).toEqual(["a"]);
    });

    it("writes null for a card that has no image yet", () => {
        const card: CardImage = { ...libraryCard("a", "Pending"), image: undefined };
        expect(serializeProject(input([card])).cards.a.front).toBeNull();
    });
});

describe("unsaveableCards", () => {
    it("reports cards whose image only exists in memory", () => {
        const blob: CardImage = {
            ...libraryCard("a", "In memory"),
            image: { kind: "blob", url: "blob:http://localhost/abc" },
        };
        expect(unsaveableCards(input([blob, libraryCard("b", "On disk", "1b")]))).toEqual(["In memory"]);
    });

    it("is empty when every image is on disk", () => {
        expect(unsaveableCards(input([libraryCard("a", "One", "1a")]))).toEqual([]);
    });
});

describe("parseProject", () => {
    const valid = () => JSON.stringify(serializeProject(input([libraryCard("a", "Card", "1a")])));

    it("rejects text that is not JSON", () => {
        expect(() => parseProject("not json")).toThrow(/not readable JSON/);
    });

    it("rejects JSON that is not a project", () => {
        expect(() => parseProject('{"hello":"world"}')).toThrow(/not a ProxKit project/);
    });

    it("refuses a project written by a newer build rather than half-reading it", () => {
        const file = JSON.parse(valid());
        file.version = PROJECT_VERSION + 1;
        expect(() => parseProject(JSON.stringify(file))).toThrow(/newer version/);
    });

    it("accepts an older version, so old projects keep opening", () => {
        const file = JSON.parse(valid());
        file.version = PROJECT_VERSION - 1 || PROJECT_VERSION;
        expect(() => parseProject(JSON.stringify(file))).not.toThrow();
    });

    it("rejects a project missing its card list", () => {
        const file = JSON.parse(valid());
        delete file.cards;
        expect(() => parseProject(JSON.stringify(file))).toThrow(/card list/);
    });
});
