import { createThumbnail } from "./imageUtils";
import type { ImageSource } from "../types/card";

/**
 * Async wrapper around createThumbnail that schedules work during idle time.
 *
 * Uses requestIdleCallback to avoid blocking the main thread during thumbnail
 * generation, falling back to setTimeout if requestIdleCallback is unavailable.
 *
 * This is an optimization layer - the actual thumbnail creation happens in
 * imageUtils.createThumbnail().
 */
export async function generateThumbnailAsync(
    source: ImageSource,
    maxWidth: number,
    maxHeight: number,
    quality: number,
    bleed: number,
    cardWidth: number,
    cardHeight: number
): Promise<string> {
    const generateThumbnail = () =>
        createThumbnail(source, maxWidth, maxHeight, quality, bleed, cardWidth, cardHeight);

    return new Promise((resolve, reject) => {
        const run = () => generateThumbnail().then(resolve, reject);

        if (typeof requestIdleCallback === "function") {
            requestIdleCallback(() => run());
        } else {
            setTimeout(run, 0);
        }
    });
}
