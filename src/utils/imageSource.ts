import { convertFileSrc } from "@tauri-apps/api/core";
import type { ImageSource } from "../types/card";
import { isTauri } from "./platform";

/** Wrap an object URL the app owns and must eventually revoke. */
export function blobSource(url: string): ImageSource {
    return { kind: "blob", url };
}

/** Wrap a path to a file on disk. Desktop only. */
export function pathSource(path: string, driveId?: string): ImageSource {
    return driveId ? { kind: "path", path, driveId } : { kind: "path", path };
}

/** Take ownership of a File's bytes as a blob URL. */
export function sourceFromFile(file: File): ImageSource {
    return blobSource(URL.createObjectURL(file));
}

/**
 * A URL the webview can render or fetch: object URLs pass through, disk paths
 * become `asset://` URLs.
 */
export function toDisplayUrl(source: ImageSource | undefined | null): string | undefined {
    if (!source) return undefined;
    return source.kind === "blob" ? source.url : convertFileSrc(source.path, "asset");
}

/**
 * The filesystem path the Rust backend needs.
 *
 * Throws for blob sources rather than handing Rust a `blob:` URL it cannot
 * open - the failure belongs here, at the boundary, not three layers down in
 * an image decoder.
 */
export function toBackendPath(source: ImageSource, label?: string): string {
    if (source.kind === "path") return source.path;
    throw new Error(
        `${label ?? "Image"} is held in memory and has no file on disk, so the ` +
        `desktop PDF backend cannot read it. It must be written to the image ` +
        `library first.`
    );
}

/** True when this source can be handed to the Rust backend as-is. */
export function hasBackendPath(source: ImageSource | undefined | null): boolean {
    return source?.kind === "path";
}

/** Revoke the underlying object URL, if we own one. Safe on disk paths. */
export function revokeSource(source: ImageSource | undefined | null): void {
    if (source?.kind === "blob") {
        URL.revokeObjectURL(source.url);
    }
}

/**
 * Whether images arriving as raw bytes can be persisted to disk on this
 * platform. On the web they never can, so they stay blob sources for the
 * lifetime of the session.
 */
export const canPersistToDisk = isTauri;
