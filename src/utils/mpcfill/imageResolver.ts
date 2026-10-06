import type { ImageSource } from "../../types/card";
import { sourceFromFile } from "../imageSource";
import { fetchIntoLibrary, isLibraryAvailable } from "../library";
import { downloadMultipleImages } from "./driveDownloader";

export interface DriveImageRequest {
    id: string;
    name: string;
}

export type ResolvedHandler = (source: ImageSource, id: string, index: number) => void;

export type RejectedHandler = (error: unknown, id: string, index: number) => void;

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
 *
 * Resolves once every request has either produced a source or been reported to
 * `onRejected`. An image that cannot be fetched - a deleted Drive file, a 404
 * from the proxy - is that card's problem alone, so it never stops the others;
 * the caller decides what to tell the user about what is missing.
 */
export async function resolveDriveImages(
    requests: DriveImageRequest[],
    libraryFolder: string | null,
    onResolved: ResolvedHandler,
    onRejected: RejectedHandler
): Promise<void> {
    if (!isLibraryAvailable(libraryFolder)) {
        await downloadMultipleImages(
            requests,
            (file, id, index) => onResolved(sourceFromFile(file), id, index),
            onRejected
        );
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
                try {
                    const source = await fetchIntoLibrary(libraryFolder, id, name);
                    onResolved(source, id, index);
                } catch (error) {
                    // Keep this worker on the queue; the next id may be fine.
                    onRejected(error, id, index);
                }
            }
        }
    );

    await Promise.all(workers);
}
