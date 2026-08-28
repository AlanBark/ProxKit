import type { ImageSource } from "../types/card";
import { toDisplayUrl } from "./imageSource";

/**
 * Creates a lower-resolution thumbnail from an image source.
 *
 * Works for both blob sources and on-disk paths: the source is resolved to a
 * URL the webview can load, then cropped and resized on a canvas. This used to
 * exist twice - once for Files, once for Tauri paths - with identical bodies.
 *
 * @param source The image to thumbnail
 * @param maxWidth Maximum width for the thumbnail
 * @param maxHeight Maximum height for the thumbnail
 * @param quality JPEG quality 0-1
 * @param bleedMm Bleed amount in millimetres to crop from all sides
 * @param cardWidthMm Card width in millimetres
 * @param cardHeightMm Card height in millimetres
 * @returns Promise resolving to a blob URL of the thumbnail
 */
export async function createThumbnail(
    source: ImageSource,
    maxWidth: number = 400,
    maxHeight: number = 400,
    quality: number = 0.85,
    bleedMm: number = 0,
    cardWidthMm: number = 63,
    cardHeightMm: number = 88
): Promise<string> {
    const src = toDisplayUrl(source);
    if (!src) {
        throw new Error("Cannot create a thumbnail from an empty image source");
    }

    return new Promise((resolve, reject) => {
        const img = new Image();

        // asset:// URLs are a different origin to the webview, so the canvas
        // would be tainted without this. Object URLs are same-origin already.
        if (source.kind === "path") {
            img.crossOrigin = "anonymous";
        }

        img.onload = () => {
            // Calculate bleed in pixels based on image dimensions
            const pxPerMmWidth = img.width / cardWidthMm;
            const pxPerMmHeight = img.height / cardHeightMm;
            const pxPerMm = (pxPerMmWidth + pxPerMmHeight) / 2;
            const bleedPx = bleedMm * pxPerMm;

            // Source dimensions (crop out bleed from original image)
            const sourceX = bleedPx;
            const sourceY = bleedPx;
            const sourceWidth = img.width - (bleedPx * 2);
            const sourceHeight = img.height - (bleedPx * 2);

            // Calculate new dimensions maintaining aspect ratio
            let width = sourceWidth;
            let height = sourceHeight;

            if (width > maxWidth || height > maxHeight) {
                const aspectRatio = width / height;

                if (width > height) {
                    width = maxWidth;
                    height = width / aspectRatio;
                } else {
                    height = maxHeight;
                    width = height * aspectRatio;
                }
            }

            // Create canvas and draw cropped and resized image
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            // Draw the cropped portion of the image (excluding bleed) to the canvas
            ctx.drawImage(
                img,
                sourceX, sourceY, sourceWidth, sourceHeight,  // Source rectangle (crop)
                0, 0, width, height                            // Destination rectangle (resize)
            );

            // Convert to blob
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error('Failed to create thumbnail blob'));
                        return;
                    }
                    resolve(URL.createObjectURL(blob));
                },
                'image/jpeg',
                quality
            );
        };

        img.onerror = () => {
            reject(new Error(`Failed to load image for thumbnailing: ${src}`));
        };

        img.src = src;
    });
}
