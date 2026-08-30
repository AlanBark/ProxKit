import { describe, it, expect } from "vitest";
import { themeVariables } from "./initTheme";
import { THEMES, themeById } from "./themes";

function variablesFor(themeId: string): Map<string, string> {
    return new Map(themeVariables(themeById(themeId).colors));
}

describe("themeVariables", () => {
    it("exposes every palette role as a kebab-case variable", () => {
        const vars = variablesFor("cyan");
        expect(vars.get("--bg-input")).toBe("#1f2e3a");
        expect(vars.get("--text-primary")).toBeDefined();
        expect(vars.get("--gradient-from")).toBeDefined();
    });

    // HeroUI reads HSL channel triplets, so a role that fails to convert would
    // silently leave that control on the colour it was compiled with.
    it("converts every mapped HeroUI role, including the translucent ones", () => {
        const vars = variablesFor("cyan");
        const heroui = [
            "--heroui-primary",
            "--heroui-background",
            "--heroui-content1",
            "--heroui-content2",
            "--heroui-content3",
            "--heroui-content4",
            "--heroui-default",
            "--heroui-default-100",
            "--heroui-divider",
            "--heroui-focus",
            "--heroui-foreground",
        ];

        for (const name of heroui) {
            const value = vars.get(name);
            expect(value, `${name} should be set`).toBeDefined();
            expect(value, `${name} should be HSL channels`).toMatch(/^\d+ \d+% \d+%$/);
        }
    });

    it("derives HeroUI colours from the palette, not from a fixed accent", () => {
        const cyan = variablesFor("cyan");
        const amber = variablesFor("amber");

        // The input and dropdown surfaces are what a user notices first.
        expect(amber.get("--heroui-content1")).not.toBe(cyan.get("--heroui-content1"));
        expect(amber.get("--heroui-content4")).not.toBe(cyan.get("--heroui-content4"));
        expect(amber.get("--heroui-primary")).not.toBe(cyan.get("--heroui-primary"));
    });

    it("gives every theme a distinct background and accent", () => {
        const backgrounds = new Set<string>();
        const accents = new Set<string>();

        for (const theme of THEMES) {
            const vars = new Map(themeVariables(theme.colors));
            backgrounds.add(`${vars.get("--gradient-from")}|${vars.get("--gradient-to")}`);
            accents.add(vars.get("--primary")!);
        }

        expect(backgrounds.size).toBe(THEMES.length);
        expect(accents.size).toBeGreaterThan(1);
    });

    it("converts a known colour correctly", () => {
        // #06b6d4 is cyan-500: hue ~189, high saturation, mid lightness.
        const vars = variablesFor("cyan");
        expect(vars.get("--heroui-primary")).toBe("189 94% 43%");
    });
});
