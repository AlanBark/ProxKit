/**
 * Minimal path helpers that work for both POSIX and Windows separators.
 *
 * Paths here come from the Tauri dialog, so they use the host's separator; we
 * only ever need to split them, never to build platform-specific ones.
 */

const SEPARATORS = /[/\\]/;

/** The directory portion of a path, or null if there is no separator. */
export function dirname(path: string): string | null {
    const index = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    return index > 0 ? path.slice(0, index) : null;
}

/** The final segment of a path. */
export function basename(path: string): string {
    return path.split(SEPARATORS).pop() || path;
}

/** Joins a directory and a filename using whichever separator the directory uses. */
export function joinPath(dir: string, name: string): string {
    const separator = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
    return dir.endsWith(separator) ? dir + name : dir + separator + name;
}
