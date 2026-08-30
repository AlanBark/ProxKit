/**
 * Theme Initialization
 *
 * Injects a palette into CSS custom properties. Called once before React mounts
 * so the first paint is themed, then again whenever the user picks a theme.
 */

import { colors } from './colors';
import type { Palette } from './themes';

/**
 * HeroUI reads its colours as HSL channel triplets, not hex, and bakes them at
 * build time from hero.ts. Overriding the variables at runtime is what lets its
 * components follow the theme instead of staying on the palette they were
 * compiled with.
 *
 * Only solid colours are mapped: the translucent surface and border roles carry
 * an alpha that HeroUI expresses through separate opacity variables, and they
 * read acceptably across all themes as they are.
 */
const HEROUI_ROLES: Partial<Record<keyof Palette, string[]>> = {
    primary: ['--heroui-primary'],
    danger: ['--heroui-danger'],
    success: ['--heroui-success'],
    warning: ['--heroui-warning'],
    bgApp: ['--heroui-background'],
    bgDropdown: ['--heroui-content1'],
    bgSurface: ['--heroui-content2'],
    bgElevated: ['--heroui-content3', '--heroui-default-50'],
    bgInput: [
        '--heroui-content4',
        '--heroui-default',
        '--heroui-default-100',
        '--heroui-default-200',
    ],
    border: ['--heroui-divider', '--heroui-default-300'],
    borderFocus: ['--heroui-focus'],
    textMuted: ['--heroui-default-400'],
    textSecondary: ['--heroui-default-500'],
    textPrimary: [
        '--heroui-foreground',
        '--heroui-default-foreground',
        '--heroui-content1-foreground',
        '--heroui-content2-foreground',
        '--heroui-content3-foreground',
        '--heroui-content4-foreground',
        '--heroui-default-600',
        '--heroui-default-700',
        '--heroui-default-800',
        '--heroui-default-900',
    ],
};

/** Red, green and blue in 0-1, from hex or rgb()/rgba(). */
function toRgb(value: string): [number, number, number] | null {
    const trimmed = value.trim();

    const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed);
    if (hexMatch) {
        const hex = hexMatch[1].length === 3
            ? hexMatch[1].split('').map((c) => c + c).join('')
            : hexMatch[1];
        return [
            parseInt(hex.slice(0, 2), 16) / 255,
            parseInt(hex.slice(2, 4), 16) / 255,
            parseInt(hex.slice(4, 6), 16) / 255,
        ];
    }

    // Alpha is dropped: HeroUI carries opacity in its own variables, so a
    // translucent surface colour still needs its hue as solid channels.
    const rgbMatch = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(trimmed);
    if (rgbMatch) {
        return [+rgbMatch[1] / 255, +rgbMatch[2] / 255, +rgbMatch[3] / 255];
    }

    return null;
}

/** `H S% L%`, the shape HeroUI expects, or null if the colour is unparseable. */
function hexToHslChannels(value: string): string | null {
    const rgb = toRgb(value);
    if (!rgb) return null;
    const [r, g, b] = rgb;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    const delta = max - min;

    let hue = 0;
    let saturation = 0;

    if (delta !== 0) {
        saturation = delta / (1 - Math.abs(2 * lightness - 1));
        if (max === r) hue = ((g - b) / delta) % 6;
        else if (max === g) hue = (b - r) / delta + 2;
        else hue = (r - g) / delta + 4;
        hue *= 60;
        if (hue < 0) hue += 360;
    }

    return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

/**
 * Every CSS variable a palette produces, as name/value pairs.
 *
 * Kept separate from applying them so the mapping can be tested without a DOM -
 * a role that silently fails to convert would otherwise be invisible until
 * someone noticed a control had not changed colour.
 */
export function themeVariables(palette: Palette): [string, string][] {
    const variables: [string, string][] = [];

    // Our own variables: camelCase becomes kebab-case.
    for (const [key, value] of Object.entries(palette)) {
        variables.push(['--' + key.replace(/([A-Z])/g, '-$1').toLowerCase(), value]);
    }

    // HeroUI's variables, so its components follow along.
    for (const [role, names] of Object.entries(HEROUI_ROLES)) {
        const channels = hexToHslChannels(palette[role as keyof Palette]);
        if (!channels) continue;
        for (const name of names) variables.push([name, channels]);
    }

    return variables;
}

export function applyTheme(palette: Palette) {
    const root = document.documentElement;
    for (const [name, value] of themeVariables(palette)) {
        // Important, because HeroUI declares the same variables on `.dark`,
        // which is the very element these are being set on.
        root.style.setProperty(name, value, 'important');
    }
}

/** Applies the built-in palette, before stored settings are available. */
export function initTheme() {
    applyTheme(colors);
}
