import { useCallback, useEffect, useState } from "react";
import { isTauri } from "../utils/platform";

export type UpdateState =
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "upToDate" }
    | { kind: "available"; version: string; notes?: string }
    | { kind: "downloading"; percent: number }
    | { kind: "ready" }
    | { kind: "error"; message: string };

/**
 * Checking for and installing new versions.
 *
 * Everything is loaded on demand, so the browser build never pulls in the
 * desktop-only plugins. Checking is manual rather than automatic on launch: an
 * update prompt appearing over someone's work uninvited is worse than a button
 * they press when it suits them.
 */
export function useUpdater() {
    const [state, setState] = useState<UpdateState>({ kind: "idle" });
    const [currentVersion, setCurrentVersion] = useState<string | null>(null);

    useEffect(() => {
        if (!isTauri) return;
        void import("@tauri-apps/api/app").then(({ getVersion }) =>
            getVersion().then(setCurrentVersion).catch(() => setCurrentVersion(null))
        );
    }, []);

    const check = useCallback(async () => {
        if (!isTauri) return;
        setState({ kind: "checking" });

        try {
            const { check: checkForUpdate } = await import("@tauri-apps/plugin-updater");
            const update = await checkForUpdate();

            if (!update) {
                setState({ kind: "upToDate" });
                return;
            }
            setState({ kind: "available", version: update.version, notes: update.body });
        } catch (error) {
            setState({
                kind: "error",
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }, []);

    /**
     * Downloads and installs, then restarts.
     *
     * The update is fetched again rather than held from the check: keeping a
     * handle alive across a user deciding whether to install is a good way to
     * act on a stale one.
     */
    const install = useCallback(async () => {
        if (!isTauri) return;
        setState({ kind: "downloading", percent: 0 });

        try {
            const { check: checkForUpdate } = await import("@tauri-apps/plugin-updater");
            const update = await checkForUpdate();
            if (!update) {
                setState({ kind: "upToDate" });
                return;
            }

            let downloaded = 0;
            let total = 0;

            await update.downloadAndInstall((event) => {
                if (event.event === "Started") {
                    total = event.data.contentLength ?? 0;
                } else if (event.event === "Progress") {
                    downloaded += event.data.chunkLength;
                    setState({
                        kind: "downloading",
                        percent: total > 0 ? Math.round((downloaded / total) * 100) : 0,
                    });
                } else if (event.event === "Finished") {
                    setState({ kind: "ready" });
                }
            });

            const { relaunch } = await import("@tauri-apps/plugin-process");
            await relaunch();
        } catch (error) {
            setState({
                kind: "error",
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }, []);

    return { state, currentVersion, check, install };
}
