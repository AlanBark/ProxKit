/**
 * Theme-based className utilities
 *
 * Pre-built className strings that use theme colors.
 */

export const buttonStyles = {
  primary: 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white',
  success: 'bg-[var(--success)] hover:bg-[var(--success)] text-white',
  danger: 'bg-[var(--danger)] hover:bg-[var(--danger-hover)] text-white',
  ghost: 'bg-transparent hover:bg-[var(--bg-hover)] text-[var(--text-primary)]',
} as const;

export const cardStyles = {
  default: 'bg-[var(--bg-surface)] border-[var(--border)] hover:border-[var(--border-hover)]',
  elevated: 'bg-[var(--bg-elevated)] border-[var(--border)]',
  interactive: 'bg-[var(--bg-surface)] border-[var(--border)] hover:border-[var(--primary)]',
} as const;

export const inputStyles = {
  default: 'bg-[var(--bg-input)] border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--border-focus)]',
  error: 'bg-[var(--bg-input)] border-[var(--danger)] text-[var(--text-primary)] focus:border-[var(--danger)]',
} as const;

export const textStyles = {
  primary: 'text-[var(--text-primary)]',
  secondary: 'text-[var(--text-secondary)]',
  muted: 'text-[var(--text-muted)]',
  success: 'text-[var(--success)]',
  warning: 'text-[var(--warning)]',
  danger: 'text-[var(--danger)]',
} as const;

export const backgroundStyles = {
  app: 'bg-[var(--bg-app)]',
  surface: 'bg-[var(--bg-surface)]',
  elevated: 'bg-[var(--bg-elevated)]',
  input: 'bg-[var(--bg-input)]',
} as const;
