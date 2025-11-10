/**
 * Theme Colors Configuration
 *
 * ONE color per use case - edit these to change the theme.
 */


export const colors = {
    // Actions & Interactive
    primary: '#06b6d4',           // Bright cyan
    primaryHover: '#0891b2',      // Deep cyan
    danger: '#f43f5e',            // Rose red
    dangerHover: '#e11d48',
    success: '#10b981',           // Emerald
    warning: '#fb923c',           // Lighter orange accent

    // Backgrounds - lightened
    bgApp: '#111b22',             // Lighter slate-blue
    bgSurface: 'rgba(255, 255, 255, 0.1',    // More visible
    bgElevated: 'rgba(255, 255, 255, 0.2)',   // Liquid glass effect
    bgInput: '#1f2e3a',           // Lighter input
    bgHover: 'rgba(6, 182, 212, 0.15)',    // Slightly more visible
    bgDropdown: '#19232d',        // Solid background for dropdowns/menus

    // Borders
    border: 'rgba(34, 181, 201, 0.38)',      // More visible
    borderHover: 'rgba(6, 182, 212, 0.6)', // Stronger hover
    borderFocus: '#06b6d4',

    // Text
    textPrimary: '#e0f2fe',       // Cyan tint
    textSecondary: '#94a3b8',
    textMuted: '#F2F4F3',        // Light grayish

    // Overlays
    overlayDark: 'rgba(17, 27, 34, 0.9)',
    overlayLight: 'rgba(17, 27, 34, 0.7)',
} as const;