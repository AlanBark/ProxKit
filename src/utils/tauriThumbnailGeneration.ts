import { convertFileSrc } from "@tauri-apps/api/core";

/**
 * Creates a thumbnail from a file path in Tauri environment.
 * Uses convertFileSrc to create a URL that the webview can load.
 */
export async function generateThumbnailFromPath(
    filePath: string,
    maxWidth: number = 800,
    maxHeight: number = 800,
    quality: number = 0.85,
    bleedMm: number = 0,
    cardWidthMm: number = 63,
    cardHeightMm: number = 88
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // Enable CORS for the image to avoid tainted canvas
        img.crossOrigin = "anonymous";
        // Convert the file path to an asset:// URL that Tauri's webview can load
        const assetUrl = convertFileSrc(filePath, "asset");

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
                    const thumbnailUrl = URL.createObjectURL(blob);
                    resolve(thumbnailUrl);
                },
                'image/jpeg',
                quality
            );
        };

        img.onerror = () => {
            reject(new Error(`Failed to load image from path: ${filePath}`));
        };

        img.src = assetUrl;
    });
}
