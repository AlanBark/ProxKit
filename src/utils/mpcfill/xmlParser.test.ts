// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { parseMPCFillXML } from "./xmlParser";

function order(fronts: string, backs = ""): string {
    return `<order>
        <details><quantity>4</quantity><bracket>18</bracket></details>
        <fronts>${fronts}</fronts>
        ${backs && `<backs>${backs}</backs>`}
        <cardback>shared-back</cardback>
    </order>`;
}

function card(id: string, slots: string): string {
    return `<card><id>${id}</id><slots>${slots}</slots><name>${id}.png</name><query>${id}</query></card>`;
}

describe("parseMPCFillXML", () => {
    it("keeps every copy of a card listed under one <slots>", () => {
        const { order: parsed, errors } = parseMPCFillXML(order(card("island", "0,1,2")));

        expect(errors).toEqual([]);
        expect(parsed.cards).toHaveLength(1);
        expect(parsed.cards[0]).toMatchObject({ id: "island", slots: [0, 1, 2] });
    });

    it("orders cards by the first slot they fill", () => {
        const { order: parsed } = parseMPCFillXML(order(card("forest", "1, 3") + card("island", "2,0")));

        expect(parsed.cards.map(c => [c.id, c.slots])).toEqual([
            ["island", [0, 2]],
            ["forest", [1, 3]],
        ]);
    });

    it("gives a unique back to every copy whose slot it lists", () => {
        const { order: parsed } = parseMPCFillXML(order(card("dfc", "0,1"), card("dfc-back", "0,1")));

        expect(parsed.cards).toHaveLength(1);
        expect(parsed.cards[0]).toMatchObject({ id: "dfc", backId: "dfc-back", slots: [0, 1] });
    });

    it("splits copies of a front that were given different backs", () => {
        const { order: parsed } = parseMPCFillXML(order(card("dfc", "0,1,2"), card("back-a", "0") + card("back-b", "2")));

        expect(parsed.cards.map(c => [c.backId, c.slots])).toEqual([
            ["back-a", [0]],
            [undefined, [1]],
            ["back-b", [2]],
        ]);
    });

    it("reports a front with no slots instead of placing it at slot 0", () => {
        const { order: parsed, errors } = parseMPCFillXML(order(card("island", "")));

        expect(parsed.cards).toEqual([]);
        expect(errors).toContain("Card at index 0 is missing a <slots> element");
    });
});
