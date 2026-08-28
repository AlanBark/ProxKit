import { describe, it, expect } from "vitest";
import { BUILT_IN_PRESETS, matchPreset } from "./presets";
import { CARD_DIMENSIONS } from "../types/card";
import { PAGE_SIZE_OPTIONS } from "./projectSettingsStore";
import { GRID_COLS, GRID_ROWS } from "../utils/pdf/cardLayoutUtils";

const tcg = BUILT_IN_PRESETS.find((p) => p.id === "tcg")!;
const poker = BUILT_IN_PRESETS.find((p) => p.id === "poker")!;

/** The card settings a freshly-loaded app holds, which are the TCG defaults. */
function defaults() {
    return {
        cardWidth: CARD_DIMENSIONS.width,
        cardHeight: CARD_DIMENSIONS.height,
        defaultBleed: CARD_DIMENSIONS.standardBleed,
        defaultCardBackBleed: CARD_DIMENSIONS.standardBleed,
        outputBleed: CARD_DIMENSIONS.outputBleed,
    };
}

describe("built-in presets", () => {
    it("ships a TCG and a playing-card format", () => {
        expect(tcg.label).toBe("MTG");
        expect(poker.label).toBe("Playing cards");
    });

    it("keeps poker cards distinct from TCG cards", () => {
        expect(poker.cardWidth).toBe(63.5);
        expect(poker.cardHeight).toBe(88.9);
        expect(poker.cardWidth).not.toBe(tcg.cardWidth);
        expect(poker.cardHeight).not.toBe(tcg.cardHeight);
    });

    it("says nothing about page size, which is chosen separately", () => {
        for (const preset of BUILT_IN_PRESETS) {
            expect(preset).not.toHaveProperty("pageSize");
        }
    });

    it("matches the app's existing defaults, so nothing changes on first run", () => {
        expect(matchPreset(defaults())).toBe(tcg);
    });

    it("gives every preset a unique id", () => {
        const ids = BUILT_IN_PRESETS.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    // matchPreset resolves by value, so two presets with identical values would
    // make one of them unselectable - it would always read back as the other.
    it("has no two presets with identical matchable values", () => {
        const fingerprints = BUILT_IN_PRESETS.map((p) =>
            [p.cardWidth, p.cardHeight, p.defaultBleed, p.defaultCardBackBleed, p.outputBleed].join("|")
        );
        expect(new Set(fingerprints).size).toBe(fingerprints.length);
    });

    // Page size is independent of the preset, so every combination has to work.
    it("fits a full grid on every available page size", () => {
        for (const preset of BUILT_IN_PRESETS) {
            for (const page of PAGE_SIZE_OPTIONS) {
                // Sheets are used landscape, so width and height swap.
                const sheetWidth = page.height;
                const sheetHeight = page.width;
                const cellWidth = preset.cardWidth + 2 * preset.outputBleed;
                const cellHeight = preset.cardHeight + 2 * preset.outputBleed;

                expect(
                    GRID_COLS * cellWidth,
                    `${preset.id} row width on ${page.key}`
                ).toBeLessThanOrEqual(sheetWidth);
                expect(
                    GRID_ROWS * cellHeight,
                    `${preset.id} column height on ${page.key}`
                ).toBeLessThanOrEqual(sheetHeight);
            }
        }
    });
});

describe("matchPreset", () => {
    it("returns null when a card dimension has been edited", () => {
        expect(matchPreset({ ...defaults(), cardWidth: 59 })).toBeNull();
        expect(matchPreset({ ...defaults(), cardHeight: 90 })).toBeNull();
    });

    it("returns null when a bleed has been edited", () => {
        expect(matchPreset({ ...defaults(), outputBleed: 2 })).toBeNull();
        expect(matchPreset({ ...defaults(), defaultBleed: 1 })).toBeNull();
        expect(matchPreset({ ...defaults(), defaultCardBackBleed: 1 })).toBeNull();
    });

    it("identifies each built-in from its own values", () => {
        for (const preset of BUILT_IN_PRESETS) {
            expect(matchPreset(preset)).toBe(preset);
        }
    });
});
