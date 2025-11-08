/**
 * Creates a lower-resolution thumbnail from an image file
 * @param file The original image file
 * @param maxWidth Maximum width for the thumbnail (default 800px)
 * @param maxHeight Maximum height for the thumbnail (default 800px)
 * @param quality JPEG quality 0-1 (default 0.85)
 * @param bleedMm Bleed amount in millimeters to crop from all sides (default 0)
 * @param cardWidthMm Card width in millimeters (default 63mm for Magic cards)
 * @param cardHeightMm Card height in millimeters (default 88mm for Magic cards)
 * @returns Promise resolving to a blob URL of the thumbnail
 */
export async function createThumbnail(
    file: File,
    maxWidth: number = 400,
    maxHeight: number = 400,
    quality: number = 0.85,
    bleedMm: number = 0,
    cardWidthMm: number = 63,
    cardHeightMm: number = 88
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            // Clean up the temporary object URL
            URL.revokeObjectURL(objectUrl);

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
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load image'));
        };

        img.src = objectUrl;
    });
}
