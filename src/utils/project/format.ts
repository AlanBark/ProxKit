import type { CardImage, ImageSource } from "../../types/card";
import { basename } from "../paths";

export const PROJECT_FORMAT = "proxkit-project";
export const PROJECT_VERSION = 1;
export const PROJECT_EXTENSION = "proxkit";

/**
 * How a saved project points at an image.
 *
 * `path` is where the file was when the project was saved. `driveId` is present
 * for anything that came from an MPCFill import, and is what lets the image be
 * re-downloaded if the file has since moved or been deleted - the difference
 * between a project that heals itself and one that reports a missing card.
 */
export interface ProjectImageRef {
    path: string;
    fileName: string;
    driveId?: string;
}

export interface ProjectCard {
    name?: string;
    front: ProjectImageRef | null;
    back: ProjectImageRef | null;
    bleed: number;
    useCustomBleed: boolean;
    cardBackBleed: number;
    useCustomCardBackBleed: boolean;
}

export interface ProjectSettings {
    pageSize: string;
    cardWidth: number;
    cardHeight: number;
    defaultBleed: number;
    defaultCardBackBleed: number;
    outputBleed: number;
    enableCardBacks: boolean;
    groupByCardBacks: boolean;
    showAllCardBacks: boolean;
    skipSlots: number[];
}

/**
 * A saved project.
 *
 * A manifest rather than an archive: images live in the library or wherever the
 * user keeps them, and this names them. A sixty-card project is a few kilobytes
 * instead of a few hundred megabytes.
 *
 * `cards` is keyed by id and `order` lists ids, mirroring the in-memory shape.
 * A card duplicated ten times appears once in `cards` and ten times in `order`,
 * which is what keeps duplicates the same card rather than copies of it.
 */
export interface ProjectFile {
    format: typeof PROJECT_FORMAT;
    version: number;
    savedAt: string;
    settings: ProjectSettings;
    defaultCardBack: ProjectImageRef | null;
    cards: Record<string, ProjectCard>;
    order: string[];
}

/** A saved reference to an image, or null if it has no file to point at. */
export function toImageRef(source: ImageSource | undefined): ProjectImageRef | null {
    // Only on-disk images can be named in a way that survives the session; an
    // in-memory blob has no identity to write down.
    if (source?.kind !== "path") return null;

    return {
        path: source.path,
        fileName: basename(source.path),
        ...(source.driveId ? { driveId: source.driveId } : {}),
    };
}

export interface SerializeInput {
    settings: ProjectSettings;
    defaultCardBack: ImageSource | null;
    cardMap: Map<string, CardImage>;
    cardOrder: string[];
}

/** Builds the object written to disk. Pure - no filesystem access. */
export function serializeProject(input: SerializeInput): ProjectFile {
    const cards: Record<string, ProjectCard> = {};

    // Only cards actually in the order are worth saving; anything else is
    // unreachable state.
    for (const id of new Set(input.cardOrder)) {
        const card = input.cardMap.get(id);
        if (!card) continue;

        cards[id] = {
            ...(card.name ? { name: card.name } : {}),
            front: toImageRef(card.image),
            back: toImageRef(card.cardBack),
            bleed: card.bleed,
            useCustomBleed: card.useCustomBleed,
            cardBackBleed: card.cardBackBleed,
            useCustomCardBackBleed: card.useCustomCardBackBleed,
        };
    }

    return {
        format: PROJECT_FORMAT,
        version: PROJECT_VERSION,
        savedAt: new Date().toISOString(),
        settings: input.settings,
        defaultCardBack: toImageRef(input.defaultCardBack ?? undefined),
        cards,
        // Drop ids that lost their card, so order and cards cannot disagree.
        order: input.cardOrder.filter((id) => id in cards),
    };
}

/** Cards whose images could not be written down, by name. */
export function unsaveableCards(input: SerializeInput): string[] {
    const names: string[] = [];
    for (const id of new Set(input.cardOrder)) {
        const card = input.cardMap.get(id);
        if (card && card.image && card.image.kind !== "path") {
            names.push(card.name ?? id);
        }
    }
    return names;
}

/**
 * Reads a project file, rejecting anything this build cannot understand.
 *
 * Deliberately strict: a half-understood project would silently lose cards or
 * settings, which is worse than refusing to open it.
 */
export function parseProject(json: string): ProjectFile {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        throw new Error("That file is not a valid project - it is not readable JSON.");
    }

    const file = parsed as Partial<ProjectFile>;

    if (file?.format !== PROJECT_FORMAT) {
        throw new Error("That file is not a ProxKit project.");
    }
    if (typeof file.version !== "number") {
        throw new Error("That project file has no version and cannot be read.");
    }
    if (file.version > PROJECT_VERSION) {
        throw new Error(
            `That project was saved by a newer version of ProxKit (format ${file.version}, ` +
            `this build reads ${PROJECT_VERSION}). Update to open it.`
        );
    }
    if (!file.settings || typeof file.settings !== "object") {
        throw new Error("That project file is missing its settings.");
    }
    if (!file.cards || typeof file.cards !== "object" || !Array.isArray(file.order)) {
        throw new Error("That project file is missing its card list.");
    }

    return file as ProjectFile;
}
