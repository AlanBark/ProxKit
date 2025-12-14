import { createThumbnail } from "./imageUtils";

/**
 * Async wrapper around createThumbnail that schedules work during idle time.
 *
 * Uses requestIdleCallback to avoid blocking the main thread during thumbnail generation,
 * falling back to setTimeout if requestIdleCallback is not available.
 *
 * This is an optimization layer - the actual thumbnail creation happens in imageUtils.createThumbnail().
 */
export async function generateThumbnailAsync(
    file: File,
    maxWidth: number,
    maxHeight: number,
    quality: number,
    bleed: number,
    cardWidth: number,
    cardHeight: number
): Promise<string> {
    const generateThumbnail = () => {
        return createThumbnail(file, maxWidth, maxHeight, quality, bleed, cardWidth, cardHeight);
    };

    return new Promise<string>((resolve, reject) => {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(async () => {
                try {
                    const url = await generateThumbnail();
                    resolve(url);
                } catch (error) {
                    reject(error);
                }
            });
        } else {
            setTimeout(async () => {
                try {
                    const url = await generateThumbnail();
                    resolve(url);
                } catch (error) {
                    reject(error);
                }
            }, 0);
        }
    });
}
