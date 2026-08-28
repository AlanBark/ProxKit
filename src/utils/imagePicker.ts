import type { ImageSource } from "../types/card";
import { pathSource } from "./imageSource";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp"];

/**
 * Opens the native file dialog and returns the chosen images as path sources.
 *
 * Desktop only - callers must gate on `isTauri`. Images picked this way have a
 * real file on disk, which is what the Rust PDF backend needs; anything routed
 * through an `<input type="file">` instead only ever exists in memory.
 */
export async function pickImagesFromDisk(multiple: boolean = false): Promise<ImageSource[]> {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
        multiple,
        filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }],
    });

    if (!selected) return [];
    const paths = Array.isArray(selected) ? selected : [selected];
    return paths.map(pathSource);
}

/** Convenience wrapper for the single-image case. */
export async function pickImageFromDisk(): Promise<ImageSource | null> {
    const [source] = await pickImagesFromDisk(false);
    return source ?? null;
}

/** Best-effort display name for a source, for card labels. */
export function sourceDisplayName(source: ImageSource, fallback: string): string {
    if (source.kind === "path") {
        return source.path.split(/[/\\]/).pop() || fallback;
    }
    return fallback;
}
