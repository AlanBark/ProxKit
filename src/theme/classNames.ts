/**
 * Theme-based className utilities
 *
 * Pre-built className strings that use theme colors.
 */

export const buttonStyles = {
    primary: 'bg-(--primary) hover:bg-(--primary-hover) text-white',
    success: 'bg-(--success) hover:bg-(--success) text-white',
    danger: 'bg-(--danger) hover:bg-(--danger-hover) text-white',
    ghost: 'bg-transparent hover:bg-(--bg-hover) text-(--text-primary)',
} as const;

export const cardStyles = {
    default: 'bg-(--bg-surface) border-(--border) hover:border-(--border-hover)',
    elevated: 'bg-(--bg-elevated) border-(--border)',
    interactive: 'bg-(--bg-surface) border-(--border) hover:border-(--primary)',
} as const;

export const inputStyles = {
    default: 'bg-(--bg-input) border-(--border) text-(--text-primary) focus:border-(--border-focus)',
    error: 'bg-(--bg-input) border-(--danger) text-(--text-primary) focus:border-(--danger)',
} as const;

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
