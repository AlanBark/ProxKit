import { describe, it, expect } from "vitest";
import { jigGridOffset, jigHoleLayout, jigHolesFit } from "./jigHoles";

const A4 = { width: 210, height: 297 };
const LETTER = { width: 215.9, height: 279.4 };

describe("jigHoleLayout", () => {
    it("puts a round hole and a slot 90mm apart down the left margin, centred", () => {
        const { diameter, round, slot } = jigHoleLayout(A4);

        expect(diameter).toBe(3.3);
        expect(round).toEqual({ x: 15, y: 60 });
        expect(slot).toEqual({ x: 15, y: 150, width: 3, length: 5 });
        expect(slot.y - round.y).toBe(90);
    });
});

describe("jigGridOffset", () => {
    it("moves MTG cards on A4 into the bottom-right corner, as far as Studio will cut", () => {
        // Centred, the grid is 256 x 178mm with margins of 20.5mm across and
        // 16mm down. Its print ends 11.7mm from the right and bottom edges,
        // which puts the cut lines 12.2mm in.
        const offset = jigGridOffset(A4, 63, 88, 0.5, 1);

        expect(offset.x).toBeCloseTo(20.5 - 11.7, 3);
        expect(offset.y).toBeCloseTo(16 - 11.7, 3);
    });

    it("stays centred top to bottom when the grid is too tall to drop below the top-right mark", () => {
        // 184mm tall: in the corner its top would be 16.6mm down, into the mark.
        // It stops 17.8mm from the right edge instead.
        const offset = jigGridOffset(A4, 63, 91, 0.5, 1);

        expect(offset.x).toBeCloseTo(20.5 - 17.8, 3);
        expect(offset.y).toBe(0);
    });

    it("leaves a grid alone when it has nowhere to go without hitting a mark", () => {
        expect(jigGridOffset(A4, 67, 88, 0.5, 1)).toEqual({ x: 0, y: 0 });
    });
});

describe("jigHolesFit", () => {
    it("fits beside MTG cards on A4, even at the widest spacing", () => {
        expect(jigHolesFit(A4, 63, 88, 0.5, 1)).toBe(true);
        expect(jigHolesFit(A4, 63, 88, 0.5, 2.8)).toBe(true);
    });

    it("does not fit on Letter, where the side margin is too narrow", () => {
        expect(jigHolesFit(LETTER, 63, 88, 0.5, 1)).toBe(false);
    });

    it("fits wider cards once the grid moves right", () => {
        // Centred, these would end 16.5mm in - just over the holes.
        expect(jigHolesFit(A4, 65, 88, 0.5, 1)).toBe(true);
    });

    it("does not fit once the cards are too wide to move clear", () => {
        expect(jigHolesFit(A4, 67, 88, 0.5, 1)).toBe(false);
    });
});
