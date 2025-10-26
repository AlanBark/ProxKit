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
  bgSurface: 'rgba(25, 35, 45, 0.7)',    // More visible
  bgElevated: 'rgba(30, 42, 52, 0.6)',   // Lighter elevated
  bgInput: '#1f2e3a',           // Lighter input
  bgHover: 'rgba(6, 182, 212, 0.15)',    // Slightly more visible

  // Borders
  border: 'rgba(34, 181, 201, 0.38)',      // More visible
  borderHover: 'rgba(6, 182, 212, 0.6)', // Stronger hover
  borderFocus: '#06b6d4',

  // Text
  textPrimary: '#e0f2fe',       // Cyan tint
  textSecondary: '#94a3b8',
  textMuted: '#64748b',

  // Overlays
  overlayDark: 'rgba(17, 27, 34, 0.9)',
  overlayLight: 'rgba(17, 27, 34, 0.7)',
} as const;

// export const colors = {
//   // Actions & Interactive
//   primary: '#eb2581ff',           // Primary buttons, links, active states
//   primaryHover: '#1d4ed8',      // Primary button hover
//   danger: '#ef4444',            // Delete, remove, error actions
//   dangerHover: '#dc2626',       // Danger hover state
//   success: '#22c55e',           // Success states, confirmations
//   warning: '#eab308',           // Warning states

//   // Backgrounds
//   bgApp: '#111827',             // Main app background
//   bgSurface: 'rgba(31, 41, 55, 0.5)',   // Cards, panels
//   bgElevated: 'rgba(17, 24, 39, 0.5)',  // Elevated surfaces
//   bgInput: '#1f2937',           // Input fields
//   bgHover: 'rgba(55, 65, 81, 0.5)',     // Hover states

//   // Borders
//   border: 'rgba(55, 65, 81, 0.5)',      // Default borders
//   borderHover: 'rgba(75, 85, 99, 0.5)', // Border hover
//   borderFocus: '#2563eb',               // Input focus border

//   // Text
//   textPrimary: '#ffffff',       // Main text
//   textSecondary: '#9ca3af',     // Secondary text, labels
//   textMuted: '#6b7280',         // Muted text, placeholders

//   // Overlays
//   overlayDark: 'rgba(0, 0, 0, 0.8)',   // Dark overlays
//   overlayLight: 'rgba(0, 0, 0, 0.6)',  // Light overlays
// } as const;
