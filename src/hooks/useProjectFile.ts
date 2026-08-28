import { useCallback, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useCardStore } from "../stores/cardStore";
import { useProjectSettingsStore, PAGE_SIZE_OPTIONS } from "../stores/projectSettingsStore";
import { useAppSettingsStore } from "../stores/appSettingsStore";
import { readTextFile, saveTextFile } from "../utils/library";
import { removeAllCards } from "../utils/cardOperations";
import { basename, dirname } from "../utils/paths";
import {
    PROJECT_EXTENSION,
    parseProject,
    serializeProject,
    unsaveableCards,
    type ProjectSettings,
    type SerializeInput,
} from "../utils/project/format";
import { resolveProject } from "../utils/project/resolve";
import { resolveProjectsFolder } from "../utils/project/browse";
import { join } from "@tauri-apps/api/path";

export interface ProjectStatus {
    kind: "opened" | "error";
    message: string;
}

function describe(error: unknown, fallback: string): string {
    if (typeof error === "string") return error;
    if (error instanceof Error) return error.message;
    return fallback;
}

/**
 * Creating, naming and opening `.proxkit` projects.
 *
 * A new project has no file until it is named. Once it does, useProjectAutosave
 * keeps it current and there is nothing further to press. Desktop only - a
 * project names images by path, which the browser has no concept of.
 */
export function useProjectFile() {
    const [isBusy, setIsBusy] = useState(false);
    const [status, setStatus] = useState<ProjectStatus | null>(null);

    const cardMap = useCardStore((state) => state.cardMap);
    const cardOrder = useCardStore((state) => state.cardOrder);
    const setCardMap = useCardStore((state) => state.setCardMap);
    const setCardOrder = useCardStore((state) => state.setCardOrder);
    const setDefaultCardBackThumbnail = useCardStore((state) => state.setDefaultCardBackThumbnail);
    const setProjectPath = useCardStore((state) => state.setProjectPath);

    const settings = useProjectSettingsStore();
    const libraryFolder = useAppSettingsStore((state) => state.libraryFolder);
    const projectsFolder = useAppSettingsStore((state) => state.projectsFolder);
    const setLastProjectDir = useAppSettingsStore((state) => state.setLastProjectDir);

    /**
     * Starts an empty project.
     *
     * Nothing is written: a project only becomes a file once it is named, so
     * that a session of experimenting does not litter the shelf with untitled
     * projects nobody wanted to keep.
     */
    const startNewProject = useCallback(() => {
        setStatus(null);
        removeAllCards(cardMap);
        setCardMap(new Map());
        setCardOrder([]);
        settings.setDefaultCardBack(null);
        setDefaultCardBackThumbnail(null);
        setProjectPath(null);
    }, [cardMap, setCardMap, setCardOrder, settings, setDefaultCardBackThumbnail, setProjectPath]);

    /**
     * Writes the current work to a newly named project file.
     *
     * Binding the path is what switches autosave on, so from here the project
     * keeps itself up to date.
     */
    const saveProjectAs = useCallback(async (name: string): Promise<boolean> => {
        setStatus(null);
        setIsBusy(true);
        try {
            const folder = await resolveProjectsFolder(projectsFolder);
            const path = await join(folder, `${name}.${PROJECT_EXTENSION}`);

            const input: SerializeInput = {
                settings: currentSettings(settings),
                defaultCardBack: settings.defaultCardBack,
                cardMap,
                cardOrder,
            };

            const unsaveable = unsaveableCards(input);
            if (unsaveable.length > 0) {
                setStatus({
                    kind: "error",
                    message:
                        `${unsaveable.length} card${unsaveable.length === 1 ? "" : "s"} ` +
                        `only exist in memory and cannot be saved: ${unsaveable.join(", ")}.`,
                });
                return false;
            }

            await saveTextFile(path, JSON.stringify(serializeProject(input), null, 2));
            setProjectPath(path);
            setLastProjectDir(dirname(path));
            return true;
        } catch (error) {
            setStatus({ kind: "error", message: describe(error, "Could not save the project") });
            return false;
        } finally {
            setIsBusy(false);
        }
    }, [
        projectsFolder, settings, cardMap, cardOrder, setProjectPath, setLastProjectDir,
    ]);

    /** Loads a project from a known path. */
    const openProjectFromPath = useCallback(async (path: string): Promise<boolean> => {
        if (isBusy) return false;
        setStatus(null);
        setIsBusy(true);

        try {
            const file = parseProject(await readTextFile(path));
            const resolved = await resolveProject(file, libraryFolder);

            // Release the images the previous card list owned before replacing it.
            removeAllCards(cardMap);

            settings.applyPreset(file.settings);
            settings.setPageSize(new Set([file.settings.pageSize]));
            settings.setEnableCardBacks(file.settings.enableCardBacks);
            settings.setGroupByCardBacks(file.settings.groupByCardBacks);
            settings.setShowAllCardBacks(file.settings.showAllCardBacks);
            settings.setSkipSlots(new Set(file.settings.skipSlots));
            settings.setDefaultCardBack(resolved.defaultCardBack);
            setDefaultCardBackThumbnail(null);

            setCardMap(resolved.cardMap);
            setCardOrder(resolved.cardOrder);
            setProjectPath(path);
            setLastProjectDir(dirname(path));

            if (resolved.missing.length > 0) {
                setStatus({
                    kind: "error",
                    message:
                        `${resolved.missing.length} image` +
                        `${resolved.missing.length === 1 ? "" : "s"} could not be found: ` +
                        `${resolved.missing.join(", ")}`,
                });
            }
            return true;
        } catch (error) {
            setStatus({ kind: "error", message: describe(error, "Could not open the project") });
            return false;
        } finally {
            setIsBusy(false);
        }
    }, [
        isBusy, libraryFolder, cardMap, settings, setCardMap, setCardOrder,
        setDefaultCardBackThumbnail, setProjectPath, setLastProjectDir,
    ]);

    /** Opens a project stored outside the projects folder. */
    const openProjectFromDisk = useCallback(async (): Promise<boolean> => {
        const folder = await resolveProjectsFolder(projectsFolder);
        const selected = await open({
            multiple: false,
            title: "Open Project",
            filters: [{ name: "ProxKit Project", extensions: [PROJECT_EXTENSION] }],
            defaultPath: folder,
        });
        if (typeof selected !== "string") return false;
        return openProjectFromPath(selected);
    }, [projectsFolder, openProjectFromPath]);

    return {
        startNewProject,
        saveProjectAs,
        openProjectFromPath,
        openProjectFromDisk,
        isBusy,
        status,
    };
}

/** Reads the settings a project should be saved with. */
export function currentSettings(
    settings: ReturnType<typeof useProjectSettingsStore.getState>
): ProjectSettings {
    const [key] = settings.pageSize === "all" ? [] : settings.pageSize;
    return {
        pageSize: typeof key === "string" ? key : PAGE_SIZE_OPTIONS[0].key,
        cardWidth: settings.cardWidth,
        cardHeight: settings.cardHeight,
        defaultBleed: settings.defaultBleed,
        defaultCardBackBleed: settings.defaultCardBackBleed,
        outputBleed: settings.outputBleed,
        enableCardBacks: settings.enableCardBacks,
        groupByCardBacks: settings.groupByCardBacks,
        showAllCardBacks: settings.showAllCardBacks,
        skipSlots: [...settings.skipSlots],
    };
}

export { basename };
