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

interface UniqueRequest extends DriveImageRequest {
    /** Positions in the original request list that asked for this id. */
    indices: number[];
}

/** Each distinct id once, in the order first requested, named by its first request. */
function groupById(requests: DriveImageRequest[]): UniqueRequest[] {
    const byId = new Map<string, UniqueRequest>();
    requests.forEach(({ id, name }, index) => {
        const existing = byId.get(id);
        if (existing) {
            existing.indices.push(index);
        } else {
            byId.set(id, { id, name, indices: [index] });
        }
    });
    return Array.from(byId.values());
}

/**
 * Turns MPCFill Drive references into image sources.
 *
 * With a library configured, Rust resolves each id to a file on disk and only
 * downloads what is missing, so a re-import of the same order costs nothing and
 * the results can be handed straight to the PDF backend. Without one - the web
 * build, or a desktop user who skipped setup - it falls back to downloading
 * into memory, which still works but cannot be reused or printed on desktop.
 *
 * The same id is often requested many times - every copy of a card, or a back
 * several cards share. Each id is fetched once and its result reported for
 * every request that asked for it, so copies cost one download rather than
 * several racing to write the same library file.
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
    const unique = groupById(requests);

    if (!isLibraryAvailable(libraryFolder)) {
        await downloadMultipleImages(
            unique,
            // A fresh object URL per request: each card owns and revokes its
            // own, so one shared URL would break the rest when one is removed.
            (file, id, i) => unique[i].indices.forEach(index => onResolved(sourceFromFile(file), id, index)),
            (error, id, i) => unique[i].indices.forEach(index => onRejected(error, id, index))
        );
        return;
    }

    let next = 0;
    const workers = Array.from(
        { length: Math.min(CONCURRENCY_LIMIT, unique.length) },
        async () => {
            for (;;) {
                const i = next++;
                if (i >= unique.length) return;
                const { id, name, indices } = unique[i];
                let source: ImageSource;
                try {
                    source = await fetchIntoLibrary(libraryFolder, id, name);
                } catch (error) {
                    // Keep this worker on the queue; the next id may be fine.
                    indices.forEach(index => onRejected(error, id, index));
                    continue;
                }
                // A path is safe to share - nothing revokes it.
                indices.forEach(index => onResolved(source, id, index));
            }
        }
    );

    await Promise.all(workers);
}
