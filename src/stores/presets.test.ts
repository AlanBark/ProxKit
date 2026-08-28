import { describe, it, expect } from "vitest";
import { BUILT_IN_PRESETS, matchPreset, type Preset } from "./presets";
import { CARD_DIMENSIONS } from "../types/card";

const mtg = BUILT_IN_PRESETS[0];

/** The settings a freshly-loaded app holds, which are the MTG A4 defaults. */
function defaults() {
    return {
        pageSize: new Set(["A4"]),
        cardWidth: CARD_DIMENSIONS.width,
        cardHeight: CARD_DIMENSIONS.height,
        defaultBleed: CARD_DIMENSIONS.standardBleed,
        defaultCardBackBleed: CARD_DIMENSIONS.standardBleed,
        outputBleed: CARD_DIMENSIONS.outputBleed,
    };
}

describe("built-in presets", () => {
    it("ships the Magic A4 preset", () => {
        expect(mtg.id).toBe("mtg-a4");
        expect(mtg.pageSize).toBe("A4");
    });

    it("matches the app's existing defaults, so nothing changes on first run", () => {
        expect(matchPreset(defaults())).toBe(mtg);
    });

    it("gives every preset a unique id", () => {
        const ids = BUILT_IN_PRESETS.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe("matchPreset", () => {
    it("returns null when a card dimension has been edited", () => {
        expect(matchPreset({ ...defaults(), cardWidth: 59 })).toBeNull();
    });

    it("returns null when a bleed has been edited", () => {
        expect(matchPreset({ ...defaults(), outputBleed: 2 })).toBeNull();
        expect(matchPreset({ ...defaults(), defaultBleed: 1 })).toBeNull();
        expect(matchPreset({ ...defaults(), defaultCardBackBleed: 1 })).toBeNull();
    });

    it("returns null when the page size differs", () => {
        expect(matchPreset({ ...defaults(), pageSize: new Set(["Letter"]) })).toBeNull();
    });

    it("returns null for an empty or 'all' page selection", () => {
        expect(matchPreset({ ...defaults(), pageSize: new Set() })).toBeNull();
        expect(matchPreset({ ...defaults(), pageSize: "all" })).toBeNull();
    });

    it("distinguishes presets that differ only by page size", () => {
        const letter: Preset = { ...mtg, id: "mtg-letter", label: "MTG Letter", pageSize: "Letter" };
        const presets = [mtg, letter];

        expect(matchPreset(defaults(), presets)).toBe(mtg);
        expect(matchPreset({ ...defaults(), pageSize: new Set(["Letter"]) }, presets)).toBe(letter);
    });
});
