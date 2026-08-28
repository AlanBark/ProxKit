import { useEffect, useRef, useState } from "react";
import { useCardStore } from "../stores/cardStore";
import { useProjectSettingsStore } from "../stores/projectSettingsStore";
import { saveTextFile } from "../utils/library";
import { serializeProject, unsaveableCards } from "../utils/project/format";
import { currentSettings } from "./useProjectFile";

/** How long editing has to pause before a write. */
const DEBOUNCE_MS = 800;

export type SaveState =
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "saved"; at: number }
    | { kind: "error"; message: string };

/**
 * Writes the open project back to its file as it changes.
 *
 * There is no save button, so this is the only thing standing between a user's
 * work and losing it. Two rules keep that honest:
 *
 * - it never writes before the project it is watching has finished loading,
 *   which would overwrite a project with the empty state that precedes it;
 * - it refuses to write a card list containing in-memory images, which would
 *   produce a file that silently will not reopen.
 */
export function useProjectAutosave(): SaveState {
    const [state, setState] = useState<SaveState>({ kind: "idle" });

    const projectPath = useCardStore((s) => s.projectPath);
    const cardMap = useCardStore((s) => s.cardMap);
    const cardOrder = useCardStore((s) => s.cardOrder);
    const settings = useProjectSettingsStore();

    // The project whose contents are currently in the stores. Until this agrees
    // with projectPath, what we hold belongs to a different project (or to no
    // project) and must not be written anywhere.
    const boundTo = useRef<string | null>(null);

    useEffect(() => {
        if (!projectPath) {
            boundTo.current = null;
            setState({ kind: "idle" });
            return;
        }

        // First run for this path is the load itself, not an edit.
        if (boundTo.current !== projectPath) {
            boundTo.current = projectPath;
            setState({ kind: "idle" });
            return;
        }

        const input = {
            settings: currentSettings(settings),
            defaultCardBack: settings.defaultCardBack,
            cardMap,
            cardOrder,
        };

        const unsaveable = unsaveableCards(input);
        if (unsaveable.length > 0) {
            setState({
                kind: "error",
                message:
                    `Not saved - ${unsaveable.length} card` +
                    `${unsaveable.length === 1 ? "" : "s"} only exist in memory`,
            });
            return;
        }

        let cancelled = false;
        const timer = setTimeout(async () => {
            setState({ kind: "saving" });
            try {
                await saveTextFile(projectPath, JSON.stringify(serializeProject(input), null, 2));
                if (!cancelled) setState({ kind: "saved", at: Date.now() });
            } catch (error) {
                if (!cancelled) {
                    setState({
                        kind: "error",
                        message: error instanceof Error ? error.message : "Could not save",
                    });
                }
            }
        }, DEBOUNCE_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [projectPath, cardMap, cardOrder, settings]);

    return state;
}
