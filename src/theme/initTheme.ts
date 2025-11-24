/**
 * Theme Initialization
 *
 * Injects colors from colors.ts into CSS custom properties
 */

import { colors } from './colors';

export function initTheme() {
    const root = document.documentElement;

    // Map colors object to CSS custom properties
    const colorMap: Record<string, string> = {
        '--primary': colors.primary,
        '--primary-hover': colors.primaryHover,
        '--danger': colors.danger,
        '--danger-hover': colors.dangerHover,
        '--success': colors.success,
        '--warning': colors.warning,

        '--bg-surface': colors.bgSurface,
        '--bg-elevated': colors.bgElevated,
        '--bg-input': colors.bgInput,
        '--bg-hover': colors.bgHover,

        '--border': colors.border,
        '--border-hover': colors.borderHover,
        '--border-focus': colors.borderFocus,

        '--text-primary': colors.textPrimary,
        '--text-secondary': colors.textSecondary,
        '--text-muted': colors.textMuted,

        '--overlay-dark': colors.overlayDark,
        '--overlay-light': colors.overlayLight,
    };

    // Apply all colors to :root
    Object.entries(colorMap).forEach(([property, value]) => {
        root.style.setProperty(property, value);
    });
}
