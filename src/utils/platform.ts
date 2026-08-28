/**
 * Single source of truth for which shell the app is running in.
 *
 * Previously this check was open-coded in four files using three different
 * idioms, which is how the two platforms drifted apart. Import this instead.
 */
export const isTauri = "__TAURI_INTERNALS__" in window;
