import type { StateStorage } from "zustand/middleware";
import { isTauri } from "../utils/platform";

/**
 * Desktop: a real JSON file in the app config directory, via tauri-plugin-store.
 *
 * Preferred over localStorage on desktop because it survives a webview data
 * clear and can be opened and edited by hand when diagnosing a problem.
 */
function createTauriStorage(fileName: string): StateStorage {
    let handle: Promise<Awaited<ReturnType<typeof loadStore>>> | null = null;

    async function loadStore() {
        const { load } = await import("@tauri-apps/plugin-store");
        return load(fileName, { autoSave: false });
    }

    const store = () => (handle ??= loadStore());

    return {
        getItem: async (name) => (await (await store()).get<string>(name)) ?? null,
        setItem: async (name, value) => {
            const s = await store();
            await s.set(name, value);
            await s.save();
        },
        removeItem: async (name) => {
            const s = await store();
            await s.delete(name);
            await s.save();
        },
    };
}

/** Web: localStorage, wrapped so a disabled/full store degrades to "no settings". */
function createWebStorage(): StateStorage {
    return {
        getItem: (name) => {
            try {
                return localStorage.getItem(name);
            } catch {
                return null;
            }
        },
        setItem: (name, value) => {
            try {
                localStorage.setItem(name, value);
            } catch {
                // Private browsing or quota exceeded - settings just don't stick.
            }
        },
        removeItem: (name) => {
            try {
                localStorage.removeItem(name);
            } catch {
                // As above.
            }
        },
    };
}

/**
 * Backing store for one settings scope.
 *
 * Each scope gets its own file on desktop so the two are separable on disk;
 * on the web they share localStorage and are separated by their persist keys.
 */
export function createSettingsStorage(fileName: string): StateStorage {
    return isTauri ? createTauriStorage(fileName) : createWebStorage();
}
