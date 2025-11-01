/**
 * Creates a lower-resolution thumbnail from an image file
 * @param file The original image file
 * @param maxWidth Maximum width for the thumbnail (default 800px)
 * @param maxHeight Maximum height for the thumbnail (default 800px)
 * @param quality JPEG quality 0-1 (default 0.85)
 * @returns Promise resolving to a blob URL of the thumbnail
 */
export async function createThumbnail(
    file: File,
    maxWidth: number = 400,
    maxHeight: number = 400,
    quality: number = 0.85
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            // Clean up the temporary object URL
            URL.revokeObjectURL(objectUrl);

            // Calculate new dimensions maintaining aspect ratio
            let width = img.width;
            let height = img.height;

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

            // Create canvas and draw resized image
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

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
