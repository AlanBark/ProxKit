import { describe, it, expect } from "vitest";
import { settingsReplacer, settingsReviver } from "./settingsSerialization";
import type { ImageSource } from "../types/card";

/** Round-trip a value through JSON exactly as the persist middleware does. */
function roundTrip<T>(value: T): unknown {
    return JSON.parse(JSON.stringify(value, settingsReplacer), settingsReviver);
}

describe("settings serialization", () => {
    it("preserves a Set of slot indices", () => {
        const result = roundTrip({ skipSlots: new Set([0, 3, 7]) }) as { skipSlots: Set<number> };
        expect(result.skipSlots).toBeInstanceOf(Set);
        expect([...result.skipSlots].sort()).toEqual([0, 3, 7]);
    });

    it("preserves an empty Set rather than losing the field", () => {
        const result = roundTrip({ skipSlots: new Set() }) as { skipSlots: Set<number> };
        expect(result.skipSlots).toBeInstanceOf(Set);
        expect(result.skipSlots.size).toBe(0);
    });

    it("preserves a page-size Selection", () => {
        const result = roundTrip({ pageSize: new Set(["Letter"]) }) as { pageSize: Set<string> };
        expect(result.pageSize).toBeInstanceOf(Set);
        expect([...result.pageSize]).toEqual(["Letter"]);
    });

    it("would lose Sets without the replacer, which is why it exists", () => {
        const naive = JSON.parse(JSON.stringify({ skipSlots: new Set([1, 2]) }));
        expect(naive.skipSlots).toEqual({});
    });

    it("keeps a path-backed image source", () => {
        const source: ImageSource = { kind: "path", path: "C:/cards/back.png" };
        const result = roundTrip({ defaultCardBack: source }) as { defaultCardBack: ImageSource };
        expect(result.defaultCardBack).toEqual(source);
    });

    it("drops a blob-backed image source, which has no identity across sessions", () => {
        const source: ImageSource = { kind: "blob", url: "blob:http://localhost/abc" };
        const result = roundTrip({ defaultCardBack: source }) as { defaultCardBack: null };
        expect(result.defaultCardBack).toBeNull();
    });

    it("passes ordinary settings through untouched", () => {
        const settings = {
            cardWidth: 63,
            cardHeight: 88,
            defaultBleed: 3,
            enableCardBacks: true,
            libraryFolder: "C:/Users/Shado/Downloads",
            lastOutputDir: null,
        };
        expect(roundTrip(settings)).toEqual(settings);
    });

    it("round-trips a full settings snapshot", () => {
        const snapshot = {
            pageSize: new Set(["A4"]),
            cardWidth: 63,
            skipSlots: new Set([2]),
            defaultCardBack: { kind: "path", path: "/lib/back.png" } as ImageSource,
            libraryFolder: "/lib",
        };
        const result = roundTrip(snapshot) as typeof snapshot;
        expect([...result.pageSize]).toEqual(["A4"]);
        expect([...result.skipSlots]).toEqual([2]);
        expect(result.defaultCardBack).toEqual({ kind: "path", path: "/lib/back.png" });
        expect(result.libraryFolder).toBe("/lib");
    });
});
