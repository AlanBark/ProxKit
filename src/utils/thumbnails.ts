import type { ImageSource } from "../types/card";
import { blobSource } from "./imageSource";
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
 * Identifies a thumbnail by its source file and every parameter that changes
 * how it is rendered, so a bleed or card-size change misses the cache rather
 * than returning a stale image.
 */
function thumbnailKey(path: string, params: ThumbnailParams): string {
    const name = basename(path).replace(/\.[^.]+$/, "");
    return [
        name,
        hashPath(path),
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
 * Only path-backed sources are cached: a blob has no identity beyond the
 * session that created it, so there is nothing stable to key a cache entry on.
 */
export async function getThumbnail(
    source: ImageSource,
    params: ThumbnailParams,
    libraryFolder: string | null
): Promise<ImageSource> {
    const cacheable = isLibraryAvailable(libraryFolder) && source.kind === "path";
    const key = cacheable ? thumbnailKey(source.path, params) : null;

    if (cacheable && key) {
        try {
            const cached = await findCachedThumbnail(libraryFolder, key);
            if (cached) return cached;
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

    if (cacheable && key) {
        try {
            const stored = await cacheThumbnail(libraryFolder, key, await blobUrlToBase64(blobUrl));
            // The cached file is now the source of truth, so release the blob.
            URL.revokeObjectURL(blobUrl);
            return stored;
        } catch (error) {
            console.warn("Could not write to the thumbnail cache:", error);
        }
    }

    return blobSource(blobUrl);
}
