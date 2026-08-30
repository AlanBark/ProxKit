import { colors } from "./colors";

/**
 * Every theme defines exactly the same set of roles as colors.ts.
 *
 * Values are widened to string: colors.ts is `as const`, so using its type
 * directly would demand the literal cyan hexes of every other theme.
 */
export type Palette = Record<keyof typeof colors, string>;

export interface Theme {
    id: string;
    label: string;
    /** The accent, shown as a ring around the swatch. */
    accent: string;
    colors: Palette;
}

/** Accent and surface colours, before a background is chosen. */
const CYAN: Palette = colors;

const VIOLET: Palette = {
    ...colors,
    primary: "#8b5cf6",
    primaryHover: "#7c3aed",
    success: "#22c55e",
    bgApp: "#161327",
    bgInput: "#241f3a",
    bgHover: "rgba(139, 92, 246, 0.15)",
    bgDropdown: "#1d1930",
    border: "rgba(190, 170, 255, 0.25)",
    borderHover: "rgba(139, 92, 246, 0.6)",
    borderFocus: "#8b5cf6",
    textPrimary: "#ede9fe",
    overlayDark: "rgba(22, 19, 39, 0.9)",
    overlayLight: "rgba(22, 19, 39, 0.7)",
};

const AMBER: Palette = {
    ...colors,
    primary: "#f59e0b",
    primaryHover: "#d97706",
    warning: "#fbbf24",
    bgApp: "#1c1712",
    bgInput: "#2b2419",
    bgHover: "rgba(245, 158, 11, 0.15)",
    bgDropdown: "#241d15",
    border: "rgba(255, 220, 160, 0.22)",
    borderHover: "rgba(245, 158, 11, 0.6)",
    borderFocus: "#f59e0b",
    textPrimary: "#fef3c7",
    overlayDark: "rgba(28, 23, 18, 0.9)",
    overlayLight: "rgba(28, 23, 18, 0.7)",
};

const SLATE: Palette = {
    ...colors,
    primary: "#94a3b8",
    primaryHover: "#cbd5e1",
    bgApp: "#15181c",
    bgInput: "#232830",
    bgHover: "rgba(148, 163, 184, 0.15)",
    bgDropdown: "#1b1f25",
    border: "rgba(200, 210, 225, 0.2)",
    borderHover: "rgba(148, 163, 184, 0.6)",
    borderFocus: "#94a3b8",
    textPrimary: "#e2e8f0",
    overlayDark: "rgba(21, 24, 28, 0.9)",
    overlayLight: "rgba(21, 24, 28, 0.7)",
};

/** A three-stop page background. */
function withGradient(base: Palette, from: string, via: string, to: string): Palette {
    return { ...base, gradientFrom: from, gradientVia: via, gradientTo: to };
}

/**
 * A single flat page colour.
 *
 * The stops are identical, which is also how `isGradient` tells the two kinds
 * apart - there is no separate flag that could fall out of step with the
 * colours it describes.
 */
function withFlat(base: Palette, color: string): Palette {
    return { ...base, gradientFrom: color, gradientVia: color, gradientTo: color };
}

/**
 * Colour themes.
 *
 * All are dark: the app is used beside print previews, where a bright interface
 * skews how the artwork reads. Each accent comes in a gradient and a flat
 * version, since a shifting background distracts some people and offering both
 * costs nothing.
 *
 * The first entry is the palette the app has always shipped, so an existing
 * install looks unchanged until someone picks something else.
 */
export const THEMES: readonly Theme[] = [
    {
        id: "cyan",
        label: "Cyan",
        accent: "#06b6d4",
        colors: withGradient(CYAN, "#000000", "#114357", "#8f6976"),
    },
    {
        id: "violet",
        label: "Violet",
        accent: "#8b5cf6",
        colors: withGradient(VIOLET, "#050308", "#2a1b52", "#7c5295"),
    },
    {
        id: "amber",
        label: "Amber",
        accent: "#f59e0b",
        colors: withGradient(AMBER, "#0a0704", "#4a2f10", "#8f6a3a"),
    },
    {
        id: "slate",
        label: "Slate",
        accent: "#94a3b8",
        colors: withGradient(SLATE, "#050607", "#232b35", "#5c6675"),
    },

    { id: "ink", label: "Ink", accent: "#06b6d4", colors: withFlat(CYAN, "#0d1117") },
    { id: "nightshade", label: "Nightshade", accent: "#8b5cf6", colors: withFlat(VIOLET, "#171327") },
    { id: "umber", label: "Umber", accent: "#f59e0b", colors: withFlat(AMBER, "#191410") },
    { id: "charcoal", label: "Charcoal", accent: "#94a3b8", colors: withFlat(SLATE, "#16181c") },
] as const;

export const DEFAULT_THEME_ID = THEMES[0].id;

/** Whether the page background moves through more than one colour. */
export function isGradient(theme: Theme): boolean {
    return theme.colors.gradientFrom !== theme.colors.gradientTo;
}

/** CSS painting a swatch with the theme's actual page background. */
export function swatchBackground(theme: Theme): string {
    const { gradientFrom, gradientVia, gradientTo } = theme.colors;
    return isGradient(theme)
        ? `linear-gradient(135deg, ${gradientFrom}, ${gradientVia} 55%, ${gradientTo})`
        : gradientVia;
}

/** The named theme, falling back to the default if the id is unknown. */
export function themeById(id: string | null | undefined): Theme {
    return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}
