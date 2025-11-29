const GOOGLE_APPS_SCRIPT_PROXY = 'https://script.google.com/macros/s/AKfycbwacdgZiqxpmcbE4tT6d5TL36zmd-nGBfSWIrbJyCsilH0TSG835Q0X9xcxSdKcxzLw/exec';

function getMpcImageUri(fileId: string): string {
    const origin = window.location.hostname;
    return `${GOOGLE_APPS_SCRIPT_PROXY}?id=${fileId}&origin=${origin}`;
}

function base64ToBlob(base64String: string, contentType: string): Blob {
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
}

function detectMimeType(base64String: string): string {
    if (base64String.startsWith('/9j/')) return 'image/jpeg';
    if (base64String.startsWith('iVBORw0KGgo')) return 'image/png';
    if (base64String.startsWith('UklGR')) return 'image/webp';
    if (base64String.startsWith('R0lGOD')) return 'image/gif';
    return 'image/jpeg';
}

/**
 * Downloads an image from Google Drive using Google Apps Script proxy
 */
export async function downloadImageFromDrive(
    fileId: string,
    filename: string,
    onProgress?: (loaded: number, total: number) => void
): Promise<File> {
    const proxyUrl = getMpcImageUri(fileId);

    if (onProgress) onProgress(0, 2);

    const response = await fetch(proxyUrl, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        redirect: 'follow',
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (onProgress) onProgress(1, 2);

    const base64String = await response.text();
    const mimeType = detectMimeType(base64String);
    const blob = base64ToBlob(base64String, mimeType);
    const file = new File([blob], filename, { type: mimeType });

    if (onProgress) onProgress(2, 2);

    return file;
}

/**
 * Downloads multiple images from Google Drive with progress tracking
 * Downloads in parallel with concurrency limit and staggered starts
 */
export async function downloadMultipleImages(
    fileIds: { id: string; name: string }[],
    onFileDownloaded?: (file: File, id: string, index: number) => void
): Promise<{ file: File; id: string }[]> {
    const CONCURRENCY_LIMIT = 20;
    const STAGGER_DELAY_MS = 50;

    const results: { file: File; id: string }[] = [];
    const queue = [...fileIds];
    const activeDownloads = new Set<Promise<void>>();

    const downloadFile = async ({ id, name }: { id: string; name: string }, index: number) => {
        const file = await downloadImageFromDrive(id, name);
        results[index] = { file, id };

        if (onFileDownloaded) {
            onFileDownloaded(file, id, index);
        }
    };

    let currentIndex = 0;
    while (queue.length > 0 || activeDownloads.size > 0) {
        // Start new downloads up to concurrency limit
        while (activeDownloads.size < CONCURRENCY_LIMIT && queue.length > 0) {
            const fileInfo = queue.shift()!;
            const index = currentIndex++;

            const downloadPromise = downloadFile(fileInfo, index).finally(() => {
                activeDownloads.delete(downloadPromise);
            });

            activeDownloads.add(downloadPromise);

            // Stagger the next download start
            if (queue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, STAGGER_DELAY_MS));
            }
        }

        // Wait for at least one download to complete before continuing
        if (activeDownloads.size > 0) {
            await Promise.race(activeDownloads);
        }
    }

    return results;
}
