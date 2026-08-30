import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createSettingsStorage } from './settingsStorage';
import { settingsReplacer, settingsReviver } from './settingsSerialization';
import { useStoreHydrated } from './useStoreHydrated';
import { DEFAULT_THEME_ID } from '../theme/themes';

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
    /** Directory of the last opened or saved project. */
    lastProjectDir: string | null;
    /** Where projects are kept and listed from. Null means the app data folder. */
    projectsFolder: string | null;
    /** Id of the chosen colour theme. */
    colorTheme: string;
    /** Whether first-run setup has been seen, so it is not shown again. */
    hasCompletedSetup: boolean;

    setLibraryFolder: (folder: string | null) => void;
    setLastOutputDir: (dir: string | null) => void;
    setLastProjectDir: (dir: string | null) => void;
    setProjectsFolder: (folder: string | null) => void;
    setColorTheme: (id: string) => void;
    setHasCompletedSetup: (done: boolean) => void;
}

export const useAppSettingsStore = create<AppSettingsState>()(
    persist(
        (set) => ({
            libraryFolder: null,
            lastOutputDir: null,
            lastProjectDir: null,
            projectsFolder: null,
            colorTheme: DEFAULT_THEME_ID,
            hasCompletedSetup: false,

            setLibraryFolder: (folder) => set({ libraryFolder: folder }),
            setLastOutputDir: (dir) => set({ lastOutputDir: dir }),
            setLastProjectDir: (dir) => set({ lastProjectDir: dir }),
            setProjectsFolder: (folder) => set({ projectsFolder: folder }),
            setColorTheme: (id) => set({ colorTheme: id }),
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
