/**
 * Theme-based className utilities
 *
 * Pre-built className strings that use theme colors.
 */

export const textStyles = {
    primary: 'text-(--text-primary)',
    secondary: 'text-(--text-secondary)',
    muted: 'text-(--text-muted)',
    success: 'text-(--success)',
    warning: 'text-(--warning)',
    danger: 'text-(--danger)',
} as const;

export const backgroundStyles = {
    app: 'bg-(--bg-app)',
    surface: 'bg-(--bg-surface)',
    elevated: 'bg-(--bg-elevated)',
    input: 'bg-(--bg-input)',
} as const;
