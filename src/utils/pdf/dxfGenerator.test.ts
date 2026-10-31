import { describe, it, expect } from "vitest";
import { generateCentreLineDxf, generateDxfForAllPages, MTG_CORNER_RADIUS } from "./dxfGenerator";
import { NO_GRID_OFFSET } from "./cardLayoutUtils";
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

/**
 * Where each card's cut path starts: the first point of the first edge
 * written. DXF measures y up from the bottom, so that edge is the card's
 * lower one.
 */
function edgeStarts(dxf: string): { x: number; y: number }[] {
    const pattern = /LINE\n8\nCUT_LINES\n10\n([-\d.]+)\n20\n([-\d.]+)/g;
    const lines = [...dxf.matchAll(pattern)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
    // Four lines per card, listed edge by edge.
    return lines.filter((_, i) => i % 4 === 0);
}

describe("generateDxfForAllPages", () => {
    it("spaces neighbouring cut lines by the card spacing", () => {
        for (const spacing of [1, 2.5]) {
            const starts = edgeStarts(generateDxfForAllPages([card], A4, 63, 88, spacing));

            expect(starts).toHaveLength(8);
            // Across: the next card starts one card width plus the spacing on.
            expect(starts[1].x - starts[0].x).toBeCloseTo(63 + spacing, 3);
            // Down: the second row sits one card height plus the spacing lower.
            expect(starts[0].y - starts[4].y).toBeCloseTo(88 + spacing, 3);
        }
    });

    it("keeps the cut grid centred on the sheet", () => {
        const starts = edgeStarts(generateDxfForAllPages([card], A4, 63, 88, 2.5));
        const left = starts[0].x - MTG_CORNER_RADIUS;
        const right = 297 - (starts[3].x - MTG_CORNER_RADIUS + 63);

        expect(left).toBeCloseTo(right, 3);
    });

    it("measures y up from the bottom of the sheet, as DXF does", () => {
        // MTG at 1mm: the bottom row's cut lines end 16.5mm above the bottom
        // edge. Moving the grid 5mm down the sheet brings them 5mm closer.
        const centred = edgeStarts(generateDxfForAllPages([card], A4, 63, 88, 1));
        const moved = edgeStarts(generateDxfForAllPages([card], A4, 63, 88, 1, [], MTG_CORNER_RADIUS, { x: 3, y: 5 }));

        expect(centred[4].y).toBeCloseTo(16.5, 3);
        expect(moved[4].y).toBeCloseTo(11.5, 3);
        expect(moved[4].x - centred[4].x).toBeCloseTo(3, 3);
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

    it("follows the grid when it moves", () => {
        // 6mm down the sheet is 6mm closer to the bottom edge, where DXF's y starts.
        const moved = cutLines(generateCentreLineDxf(A4, 63, 88, 1, { x: 10, y: 6 }));

        expect(moved.filter((l) => l.x1 === l.x2).map((l) => l.x1)).toEqual([94.5, 158.5, 222.5]);
        expect(moved.find((l) => l.y1 === l.y2)?.y1).toBe(99);
    });
});

/** Every arc on the cutting layer, as centre, radius and start and end angles. */
function cutArcs(dxf: string) {
    const pattern = /ARC\n8\nCUT_LINES\n10\n([-\d.]+)\n20\n([-\d.]+)\n40\n([-\d.]+)\n50\n(\d+)\n51\n(\d+)/g;
    return [...dxf.matchAll(pattern)].map((m) => m.slice(1).map(Number));
}

describe("jig holes in the cut file", () => {
    // Square corners, so the card outlines are polylines and every arc and
    // line on the cutting layer belongs to the holes.
    const dxf = generateDxfForAllPages([card], A4, 63, 88, 1, [], 0, NO_GRID_OFFSET, true);
    const arcs = cutArcs(dxf);
    const lines = cutLines(dxf);

    it("leaves them out unless asked", () => {
        expect(cutArcs(generateDxfForAllPages([card], A4, 63, 88, 1, [], 0))).toHaveLength(0);
    });

    it("cuts them alongside every card", () => {
        expect(dxf.match(/LWPOLYLINE\n8\nCUT_LINES/g)).toHaveLength(8);
        expect(arcs).toHaveLength(4);
        expect(lines).toHaveLength(2);
    });

    it("adds them to the Maximise Cut Space file too", () => {
        const centreLines = generateCentreLineDxf(A4, 63, 88, 1, NO_GRID_OFFSET, true);

        expect(cutArcs(centreLines)).toHaveLength(4);
        // Four cuts between the cards, two sides of the slot.
        expect(cutLines(centreLines)).toHaveLength(6);
    });

    it("puts the round hole at the top, 60mm down - 150mm up, as DXF measures it", () => {
        expect(arcs.slice(0, 2)).toEqual([
            [15, 150, 1.65, 0, 180],
            [15, 150, 1.65, 180, 360],
        ]);
    });

    it("draws the slot, narrower than the round hole, as rounded ends joined by straight sides", () => {
        expect(arcs.slice(2).map(([x, y, r]) => [x, y, r])).toEqual([
            [15, 61, 1.5],
            [15, 59, 1.5],
        ]);
        expect(lines.map((l) => l.x1)).toEqual([13.5, 16.5]);
        for (const l of lines) {
            expect(l.x1).toBe(l.x2);
            expect([Math.min(l.y1, l.y2), Math.max(l.y1, l.y2)]).toEqual([59, 61]);
        }
    });
});
