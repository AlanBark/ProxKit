import type { ImageSource } from "../types/card";
import { blobSource, sourceIdentity } from "./imageSource";
import { generateThumbnailAsync } from "./asyncThumbnailGeneration";
import { findCachedThumbnail, cacheThumbnail, isLibraryAvailable } from "./library";
import { basename } from "./paths";

const THUMBNAIL_MAX = 800;
const THUMBNAIL_QUALITY = 0.85;

export interface ThumbnailParams {
    bleed: number;
    cardWidth: number;
    cardHeight: number;
}

export interface ThumbnailResult {
    thumbnail: ImageSource;
    /** The key it was rendered from. Store it to detect staleness later. */
    key: string;
}

/**
 * FNV-1a, so two files with the same name in different folders do not collide
 * on one cache entry and show each other's artwork.
 */
function hashPath(value: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
}

/**
 * Identifies a thumbnail by its source and every parameter that changes how it
 * is rendered.
 *
 * This is the definition of staleness: if the key differs from the one a
 * thumbnail was rendered with, that thumbnail is wrong. Adding a new reason to
 * regenerate means adding it here, rather than writing another watcher and
 * hoping every caller remembers it.
 *
 * In-memory sources get a key too. They cannot be cached on disk, but a blob
 * URL is stable for the session - which is exactly as long as the thumbnail
 * needs to stay valid.
 */
export function thumbnailKeyFor(source: ImageSource, params: ThumbnailParams): string {
    const identity = sourceIdentity(source);
    const name = source.kind === "path"
        ? basename(source.path).replace(/\.[^.]+$/, "")
        : "memory";

    return [
        name,
        hashPath(identity),
        `b${params.bleed}`,
        `${params.cardWidth}x${params.cardHeight}`,
        `m${THUMBNAIL_MAX}`,
    ].join("_");
}

/** Strips the `data:image/jpeg;base64,` prefix a FileReader result carries. */
async function blobUrlToBase64(blobUrl: string): Promise<string> {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read thumbnail data"));
        reader.readAsDataURL(blob);
    });
    return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

/**
 * A thumbnail for `source`, reusing the library's cached copy when possible.
 *
 * Only path-backed sources are cached on disk: a blob has no identity beyond
 * the session that created it, so there is nothing stable to name a file after.
 */
export async function getThumbnail(
    source: ImageSource,
    params: ThumbnailParams,
    libraryFolder: string | null
): Promise<ThumbnailResult> {
    const key = thumbnailKeyFor(source, params);
    const cacheable = isLibraryAvailable(libraryFolder) && source.kind === "path";

    if (cacheable) {
        try {
            const cached = await findCachedThumbnail(libraryFolder, key);
            if (cached) return { thumbnail: cached, key };
        } catch (error) {
            // A cache that cannot be read is not a reason to fail; fall through
            // and render one.
            console.warn("Could not read the thumbnail cache:", error);
        }
    }

    const blobUrl = await generateThumbnailAsync(
        source,
        THUMBNAIL_MAX,
        THUMBNAIL_MAX,
        THUMBNAIL_QUALITY,
        params.bleed,
        params.cardWidth,
        params.cardHeight
    );

    if (cacheable) {
        try {
            const stored = await cacheThumbnail(libraryFolder, key, await blobUrlToBase64(blobUrl));
            // The cached file is now the source of truth, so release the blob.
            URL.revokeObjectURL(blobUrl);
            return { thumbnail: stored, key };
        } catch (error) {
            console.warn("Could not write to the thumbnail cache:", error);
        }
    }

    return { thumbnail: blobSource(blobUrl), key };
}
