import { invoke } from "@tauri-apps/api/core";
import type { ImageSource } from "../types/card";
import { pathSource } from "./imageSource";
import { isTauri } from "./platform";
import type { DirectoryEntry } from "../types/generated/DirectoryEntry";

/**
 * The image library: a user-chosen folder of card artwork on disk.
 *
 * Files are named to MPC Autofill's own convention - `Name (driveId).ext` - so
 * an existing folder of its downloads works as a library without renaming.
 * Lookups match on the `(driveId)` token and ignore the extension.
 *
 * Desktop only. On the web there is no filesystem, so every caller must check
 * `isLibraryAvailable` first and fall back to in-memory downloads.
 */

/** Whether a library can be used at all right now. */
export function isLibraryAvailable(libraryFolder: string | null): libraryFolder is string {
    return isTauri && !!libraryFolder;
}

/** Path to an image already in the library, or null if it is not there. */
export async function findInLibrary(
    libraryFolder: string,
    driveId: string
): Promise<ImageSource | null> {
    const path = await invoke<string | null>("library_find", {
        folder: libraryFolder,
        driveId,
    });
    return path ? pathSource(path, driveId) : null;
}

/**
 * The library copy of a Drive image, downloading it only if it is missing.
 *
 * The download happens in Rust rather than here: the proxy returns base64, and
 * a single card is several megabytes, so routing the bytes through the frontend
 * and back across IPC would cost far more than the request itself.
 */
export async function fetchIntoLibrary(
    libraryFolder: string,
    driveId: string,
    name: string
): Promise<ImageSource> {
    const path = await invoke<string>("library_fetch", {
        folder: libraryFolder,
        driveId,
        name,
        // The proxy expects the caller's origin, as the web build sends.
        origin: window.location.hostname,
    });
    return pathSource(path, driveId);
}

/** A cached thumbnail for this key, if one has been written before. */
export async function findCachedThumbnail(
    libraryFolder: string,
    key: string
): Promise<ImageSource | null> {
    const path = await invoke<string | null>("thumbnail_find", {
        folder: libraryFolder,
        key,
    });
    return path ? pathSource(path) : null;
}

/** Writes a rendered thumbnail into the library's `thumbnails` folder. */
export async function cacheThumbnail(
    libraryFolder: string,
    key: string,
    jpegBase64: string
): Promise<ImageSource> {
    const path = await invoke<string>("thumbnail_save", {
        folder: libraryFolder,
        key,
        data: jpegBase64,
    });
    return pathSource(path);
}

/** Whether a file still exists at this path. Desktop only. */
export async function pathExists(path: string): Promise<boolean> {
    if (!isTauri) return false;
    return invoke<boolean>("path_exists", { path });
}

/** Reads a text file chosen by the user. Desktop only. */
export async function readTextFile(path: string): Promise<string> {
    return invoke<string>("read_text_file", { path });
}

/** Writes text to a path chosen by the user. Desktop only. */
export async function saveTextFile(path: string, contents: string): Promise<void> {
    await invoke<void>("save_text_file", { path, contents });
}

/** Files with the given extension in a folder, newest first. Desktop only. */
export async function listFiles(folder: string, extension: string): Promise<DirectoryEntry[]> {
    if (!isTauri) return [];
    return invoke<DirectoryEntry[]>("list_files", { folder, extension });
}

/** Permanently removes a file. Desktop only. */
export async function deleteFile(path: string): Promise<void> {
    await invoke<void>("delete_file", { path });
}

/** Renames a file, failing rather than overwriting. Desktop only. */
export async function renameFile(from: string, to: string): Promise<void> {
    await invoke<void>("rename_file", { from, to });
}
