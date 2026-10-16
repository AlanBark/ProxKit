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
    it("makes a card for every copy listed under one <slots>", () => {
        const { order: parsed, errors } = parseMPCFillXML(order(card("island", "0,1,2")));

        expect(errors).toEqual([]);
        expect(parsed.cards.map(c => c.id)).toEqual(["island", "island", "island"]);
    });

    it("orders cards by slot, not by where they are listed", () => {
        const { order: parsed } = parseMPCFillXML(order(card("forest", "1, 3") + card("island", "2,0")));

        expect(parsed.cards.map(c => c.id)).toEqual(["island", "forest", "island", "forest"]);
    });

    it("gives a unique back to every copy whose slot it lists", () => {
        const { order: parsed } = parseMPCFillXML(order(card("dfc", "0,1"), card("dfc-back", "0,1")));

        expect(parsed.cards.map(c => c.backId)).toEqual(["dfc-back", "dfc-back"]);
    });

    it("lets copies of a front carry different backs", () => {
        const { order: parsed } = parseMPCFillXML(order(card("dfc", "0,1,2"), card("back-a", "0") + card("back-b", "2")));

        expect(parsed.cards.map(c => c.backId)).toEqual(["back-a", undefined, "back-b"]);
    });

    it("reports a front with no slots instead of placing it at slot 0", () => {
        const { order: parsed, errors } = parseMPCFillXML(order(card("island", "")));

        expect(parsed.cards).toEqual([]);
        expect(errors).toContain("Card at index 0 is missing a <slots> element");
    });
});
