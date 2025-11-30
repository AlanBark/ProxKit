/**
 * Theme Initialization
 *
 * Automatically injects all colors from colors.ts into CSS custom properties
 */

import { colors } from './colors';

export function initTheme() {
    const root = document.documentElement;

    // Automatically convert camelCase to kebab-case and inject all colors
    Object.entries(colors).forEach(([key, value]) => {
        const cssVarName = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
        root.style.setProperty(cssVarName, value);
    });
}
