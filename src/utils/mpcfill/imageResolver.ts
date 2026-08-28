import type { ImageSource } from "../../types/card";
import { sourceFromFile } from "../imageSource";
import { fetchIntoLibrary, isLibraryAvailable } from "../library";
import { downloadMultipleImages } from "./driveDownloader";

export interface DriveImageRequest {
    id: string;
    name: string;
}

export type ResolvedHandler = (source: ImageSource, id: string, index: number) => void;

/** Matches the concurrency the browser downloader has always used. */
const CONCURRENCY_LIMIT = 20;

/**
 * Turns MPCFill Drive references into image sources.
 *
 * With a library configured, Rust resolves each id to a file on disk and only
 * downloads what is missing, so a re-import of the same order costs nothing and
 * the results can be handed straight to the PDF backend. Without one - the web
 * build, or a desktop user who skipped setup - it falls back to downloading
 * into memory, which still works but cannot be reused or printed on desktop.
 */
export async function resolveDriveImages(
    requests: DriveImageRequest[],
    libraryFolder: string | null,
    onResolved: ResolvedHandler
): Promise<void> {
    if (!isLibraryAvailable(libraryFolder)) {
        await downloadMultipleImages(requests, (file, id, index) => {
            onResolved(sourceFromFile(file), id, index);
        });
        return;
    }

    let next = 0;
    const workers = Array.from(
        { length: Math.min(CONCURRENCY_LIMIT, requests.length) },
        async () => {
            for (;;) {
                const index = next++;
                if (index >= requests.length) return;
                const { id, name } = requests[index];
                const source = await fetchIntoLibrary(libraryFolder, id, name);
                onResolved(source, id, index);
            }
        }
    );

    await Promise.all(workers);
}
