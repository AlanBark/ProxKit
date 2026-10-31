import { describe, it, expect } from "vitest";
import { generateCentreLineDxf, generateDxfForAllPages, MTG_CORNER_RADIUS } from "./dxfGenerator";
import type { CardImage } from "../../types/card";

const card: CardImage = {
    id: "c0",
    image: { kind: "path", path: "/cards/c0.png" },
    bleed: 3,
    useCustomBleed: false,
    cardBackBleed: 3,
    useCustomCardBackBleed: false,
};

const A4 = { width: 210, height: 297, margin: 10 };

/** Where each card's cut path starts: the first point of its top edge. */
function topEdgeStarts(dxf: string): { x: number; y: number }[] {
    const pattern = /LINE\n8\nCUT_LINES\n10\n([-\d.]+)\n20\n([-\d.]+)/g;
    const lines = [...dxf.matchAll(pattern)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
    // Four lines per card; the top edge is the horizontal one listed first.
    return lines.filter((_, i) => i % 4 === 0);
}

describe("generateDxfForAllPages", () => {
    it("spaces neighbouring cut lines by the card spacing", () => {
        for (const spacing of [1, 2.5]) {
            const starts = topEdgeStarts(generateDxfForAllPages([card], A4, 63, 88, spacing));

            expect(starts).toHaveLength(8);
            // Across: the next card starts one card width plus the spacing on.
            expect(starts[1].x - starts[0].x).toBeCloseTo(63 + spacing, 3);
            // Down: likewise, one card height plus the spacing.
            expect(starts[4].y - starts[0].y).toBeCloseTo(88 + spacing, 3);
        }
    });

    it("keeps the cut grid centred on the sheet", () => {
        const starts = topEdgeStarts(generateDxfForAllPages([card], A4, 63, 88, 2.5));
        const left = starts[0].x - MTG_CORNER_RADIUS;
        const right = 297 - (starts[3].x - MTG_CORNER_RADIUS + 63);

        expect(left).toBeCloseTo(right, 3);
    });
});

/** Every straight cut on the cutting layer, as start and end points. */
function cutLines(dxf: string) {
    const pattern = /LINE\n8\nCUT_LINES\n10\n([-\d.]+)\n20\n([-\d.]+)\n11\n([-\d.]+)\n21\n([-\d.]+)/g;
    return [...dxf.matchAll(pattern)].map((m) => ({
        x1: Number(m[1]), y1: Number(m[2]), x2: Number(m[3]), y2: Number(m[4]),
    }));
}

describe("generateCentreLineDxf", () => {
    // A4 landscape, MTG cards at the 1mm minimum: the cut lines around the
    // cards would start 21mm in from the sides and 16.5mm down from the top.
    const lines = cutLines(generateCentreLineDxf(A4, 63, 88, 1));
    const vertical = lines.filter((l) => l.x1 === l.x2);
    const horizontal = lines.filter((l) => l.y1 === l.y2);

    it("makes one cut per gap: three between the columns, one between the rows", () => {
        expect(lines).toHaveLength(4);
        expect(vertical).toHaveLength(3);
        expect(horizontal).toHaveLength(1);
    });

    it("cuts down the middle of each gap", () => {
        expect(vertical.map((l) => l.x1)).toEqual([84.5, 148.5, 212.5]);
        expect(horizontal[0].y1).toBe(105);
    });

    it("runs every cut out to the edges of the sheet", () => {
        for (const l of vertical) expect([l.y1, l.y2]).toEqual([0, 210]);
        expect([horizontal[0].x1, horizontal[0].x2]).toEqual([0, 297]);
    });
});
