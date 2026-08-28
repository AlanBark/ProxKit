import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createSettingsStorage } from './settingsStorage';
import { settingsReplacer, settingsReviver } from './settingsSerialization';
import { useStoreHydrated } from './useStoreHydrated';

/**
 * Settings that belong to this installation, not to whatever is being printed.
 *
 * These follow the machine: they stay put when you start a new card list, and
 * they would never travel inside a saved project. Anything describing the
 * current print job belongs in projectSettingsStore instead.
 */
interface AppSettingsState {
    /** Folder holding downloaded card images. Desktop only; null until chosen. */
    libraryFolder: string | null;
    /** Directory of the last saved PDF, used to seed the save dialog. */
    lastOutputDir: string | null;
    /** Whether first-run setup has been seen, so it is not shown again. */
    hasCompletedSetup: boolean;

    setLibraryFolder: (folder: string | null) => void;
    setLastOutputDir: (dir: string | null) => void;
    setHasCompletedSetup: (done: boolean) => void;
}

export const useAppSettingsStore = create<AppSettingsState>()(
    persist(
        (set) => ({
            libraryFolder: null,
            lastOutputDir: null,
            hasCompletedSetup: false,

            setLibraryFolder: (folder) => set({ libraryFolder: folder }),
            setLastOutputDir: (dir) => set({ lastOutputDir: dir }),
            setHasCompletedSetup: (done) => set({ hasCompletedSetup: done }),
        }),
        {
            name: 'proxkit-app-settings',
            version: 1,
            storage: createJSONStorage(() => createSettingsStorage('app-settings.json'), {
                replacer: settingsReplacer,
                reviver: settingsReviver,
            }),
        }
    )
);

export function useAppSettingsHydrated(): boolean {
    return useStoreHydrated(useAppSettingsStore);
}
