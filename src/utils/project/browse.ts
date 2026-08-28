import { appDataDir, join } from "@tauri-apps/api/path";
import { listFiles, readTextFile, pathExists } from "../library";
import { PROJECT_EXTENSION, parseProject } from "./format";

/** What a project tile needs to show, without opening the project properly. */
export interface ProjectSummary {
    path: string;
    /** File name without the extension - what the user called it. */
    name: string;
    modifiedMs: number;
    cardCount: number;
    /** First card's artwork, used as the tile's cover. Absent if unreadable. */
    coverPath?: string;
    /** Set when the file could not be read, so the tile can say so. */
    error?: string;
}

/**
 * Where projects live.
 *
 * Defaults to a folder in the app's own data directory so that projects work
 * without any setup, while remaining somewhere the user can point elsewhere.
 */
export async function resolveProjectsFolder(configured: string | null): Promise<string> {
    if (configured) return configured;
    return join(await appDataDir(), "projects");
}

function stripExtension(fileName: string): string {
    const dot = fileName.lastIndexOf(".");
    return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/**
 * Reads enough of a project to describe it on a tile.
 *
 * A file that cannot be parsed still produces a summary, carrying the reason.
 * A broken project should be visible and removable, not invisible.
 */
async function summarize(path: string, fileName: string, modifiedMs: number): Promise<ProjectSummary> {
    const base: ProjectSummary = {
        path,
        name: stripExtension(fileName),
        modifiedMs,
        cardCount: 0,
    };

    try {
        const file = parseProject(await readTextFile(path));
        const coverId = file.order.find((id) => file.cards[id]?.front);
        const coverRef = coverId ? file.cards[coverId].front : null;

        return {
            ...base,
            cardCount: file.order.length,
            // Only offer a cover we can actually display.
            ...(coverRef && (await pathExists(coverRef.path)) ? { coverPath: coverRef.path } : {}),
        };
    } catch (error) {
        return {
            ...base,
            error: error instanceof Error ? error.message : "Could not read this project",
        };
    }
}

/** Every project in the folder, newest first. */
export async function listProjects(folder: string): Promise<ProjectSummary[]> {
    const files = await listFiles(folder, PROJECT_EXTENSION);
    return Promise.all(files.map((f) => summarize(f.path, f.fileName, f.modifiedMs)));
}

/**
 * A path in `folder` that no project is using yet.
 *
 * New projects are all called "Untitled" until renamed, so the first one to
 * exist takes the plain name and the rest are numbered.
 */
export async function uniqueProjectPath(folder: string, base: string): Promise<string> {
    const existing = new Set(
        (await listFiles(folder, PROJECT_EXTENSION)).map((f) => f.fileName.toLowerCase())
    );

    const candidate = (n: number) =>
        `${n === 1 ? base : `${base} ${n}`}.${PROJECT_EXTENSION}`;

    let n = 1;
    while (existing.has(candidate(n).toLowerCase())) n++;
    return join(folder, candidate(n));
}

/** The path a project would have if renamed, keeping it in the same folder. */
export async function renamedProjectPath(path: string, newName: string): Promise<string> {
    const folder = path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")));
    return join(folder, `${newName}.${PROJECT_EXTENSION}`);
}
