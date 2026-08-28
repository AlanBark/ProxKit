import type { CardImage, ImageSource } from "../../types/card";
import { pathSource } from "../imageSource";
import { fetchIntoLibrary, isLibraryAvailable, pathExists } from "../library";
import type { ProjectFile, ProjectImageRef } from "./format";

export interface ResolvedProject {
    cardMap: Map<string, CardImage>;
    cardOrder: string[];
    defaultCardBack: ImageSource | null;
    /** Names of cards whose artwork could not be found. */
    missing: string[];
}

/**
 * Finds the image a saved reference points at.
 *
 * Tries the recorded path first, since that is free and usually right. If the
 * file has moved or been deleted, anything with a Drive id can be pulled back
 * into the library - which is the whole reason the id is stored.
 */
async function resolveRef(
    ref: ProjectImageRef | null,
    libraryFolder: string | null
): Promise<ImageSource | null> {
    if (!ref) return null;

    if (await pathExists(ref.path)) {
        return pathSource(ref.path, ref.driveId);
    }

    if (ref.driveId && isLibraryAvailable(libraryFolder)) {
        try {
            return await fetchIntoLibrary(libraryFolder, ref.driveId, ref.fileName);
        } catch (error) {
            console.warn(`Could not recover ${ref.fileName} from the library:`, error);
        }
    }

    return null;
}

/**
 * Rebuilds the card list from a project file.
 *
 * A card whose artwork cannot be found is kept, without an image, rather than
 * dropped: the list keeps its shape and the user is told what to relink, which
 * beats silently opening a shorter project than the one they saved.
 */
export async function resolveProject(
    file: ProjectFile,
    libraryFolder: string | null
): Promise<ResolvedProject> {
    const cardMap = new Map<string, CardImage>();
    const missing: string[] = [];

    const entries = Object.entries(file.cards);
    const resolved = await Promise.all(
        entries.map(async ([id, saved]) => {
            const [front, back] = await Promise.all([
                resolveRef(saved.front, libraryFolder),
                resolveRef(saved.back, libraryFolder),
            ]);
            return { id, saved, front, back };
        })
    );

    for (const { id, saved, front, back } of resolved) {
        if (saved.front && !front) {
            missing.push(saved.name ?? saved.front.fileName);
        }

        cardMap.set(id, {
            id,
            name: saved.name,
            image: front ?? undefined,
            cardBack: back ?? undefined,
            bleed: saved.bleed,
            useCustomBleed: saved.useCustomBleed,
            cardBackBleed: saved.cardBackBleed,
            useCustomCardBackBleed: saved.useCustomCardBackBleed,
            // Thumbnails are derived, so they are regenerated rather than saved.
            thumbnailLoading: front !== null,
        });
    }

    const defaultCardBack = await resolveRef(file.defaultCardBack, libraryFolder);

    return {
        cardMap,
        cardOrder: file.order.filter((id) => cardMap.has(id)),
        defaultCardBack,
        missing,
    };
}
