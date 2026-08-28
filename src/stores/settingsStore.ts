import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useEffect, useState } from 'react';
import type { Selection } from '@heroui/react';
import { CARD_DIMENSIONS, type ImageSource } from '../types/card';
import { CARDS_PER_PAGE } from '../utils/pdf/cardLayoutUtils';
import { settingsStorage } from './settingsStorage';
import { settingsReplacer, settingsReviver } from './settingsSerialization';

export const PAGE_SIZE_OPTIONS = [
    { key: "A4", label: "A4", width: 210, height: 297 },
    { key: "Letter", label: "Letter", width: 215.9, height: 279.4 }
] as const;

/**
 * User settings that outlive a session.
 *
 * Everything in this store is persisted - that is the point of it being a
 * separate store. Session state (the card list, generated thumbnails, blob
 * URLs) lives in cardStore and is deliberately not persisted, so there is no
 * list of exceptions to keep in sync.
 */
interface SettingsState {
    // Page and card dimensions
    pageSize: Selection;
    cardWidth: number;
    cardHeight: number;

    // Bleed settings
    defaultBleed: number;
    defaultCardBackBleed: number;
    outputBleed: number;

    // Card back settings
    enableCardBacks: boolean;
    /** Only path-backed sources survive a restart; see settingsReplacer. */
    defaultCardBack: ImageSource | null;
    groupByCardBacks: boolean;
    showAllCardBacks: boolean;

    // Layout
    skipSlots: Set<number>;

    /** Folder holding downloaded card images. Desktop only; null until chosen. */
    libraryFolder: string | null;
    /** Directory of the last saved PDF, used to seed the save dialog. */
    lastOutputDir: string | null;

    setPageSize: (size: Selection) => void;
    setCardWidth: (width: number) => void;
    setCardHeight: (height: number) => void;
    setDefaultBleed: (bleed: number) => void;
    setDefaultCardBackBleed: (bleed: number) => void;
    setOutputBleed: (bleed: number) => void;
    setEnableCardBacks: (enabled: boolean) => void;
    setDefaultCardBack: (source: ImageSource | null) => void;
    setGroupByCardBacks: (group: boolean) => void;
    setShowAllCardBacks: (show: boolean) => void;
    setSkipSlots: (slots: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
    toggleSkipSlot: (slotIndex: number) => void;
    setLibraryFolder: (folder: string | null) => void;
    setLastOutputDir: (dir: string | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            pageSize: new Set(["A4"]),
            cardWidth: CARD_DIMENSIONS.width,
            cardHeight: CARD_DIMENSIONS.height,
            defaultBleed: CARD_DIMENSIONS.standardBleed,
            defaultCardBackBleed: CARD_DIMENSIONS.standardBleed,
            outputBleed: CARD_DIMENSIONS.outputBleed,
            enableCardBacks: false,
            defaultCardBack: null,
            groupByCardBacks: false,
            showAllCardBacks: false,
            skipSlots: new Set(),
            libraryFolder: null,
            lastOutputDir: null,

            setPageSize: (size) => set({ pageSize: size }),
            setCardWidth: (width) => set({ cardWidth: width }),
            setCardHeight: (height) => set({ cardHeight: height }),
            setDefaultBleed: (bleed) => set({ defaultBleed: bleed }),
            setDefaultCardBackBleed: (bleed) => set({ defaultCardBackBleed: bleed }),
            setOutputBleed: (bleed) => set({ outputBleed: bleed }),
            setEnableCardBacks: (enabled) => set({ enableCardBacks: enabled }),
            setDefaultCardBack: (source) => set({ defaultCardBack: source }),
            setGroupByCardBacks: (group) => set({ groupByCardBacks: group }),
            setShowAllCardBacks: (show) => set({ showAllCardBacks: show }),
            setSkipSlots: (slots) => set((state) => ({
                skipSlots: typeof slots === 'function' ? slots(state.skipSlots) : slots
            })),
            toggleSkipSlot: (slotIndex) => set((state) => {
                const newSkipSlots = new Set(state.skipSlots);
                if (newSkipSlots.has(slotIndex)) {
                    newSkipSlots.delete(slotIndex);
                } else {
                    // At least one slot per page must remain usable.
                    if (newSkipSlots.size >= CARDS_PER_PAGE - 1) {
                        console.warn(`Cannot skip slot ${slotIndex}: at least 1 slot per page must remain active`);
                        return state;
                    }
                    newSkipSlots.add(slotIndex);
                }
                return { skipSlots: newSkipSlots };
            }),
            setLibraryFolder: (folder) => set({ libraryFolder: folder }),
            setLastOutputDir: (dir) => set({ lastOutputDir: dir }),
        }),
        {
            name: 'proxkit-settings',
            version: 1,
            storage: createJSONStorage(() => settingsStorage, {
                replacer: settingsReplacer,
                reviver: settingsReviver,
            }),
        }
    )
);

/**
 * Whether persisted settings have been read back yet.
 *
 * The desktop backing store is async, so the store briefly holds defaults on
 * startup. Effects that treat a settings change as a user edit must wait for
 * this, or they will act on the defaults-to-stored transition.
 */
export function useSettingsHydrated(): boolean {
    const [hydrated, setHydrated] = useState(() => useSettingsStore.persist.hasHydrated());

    useEffect(() => {
        const unsubFinish = useSettingsStore.persist.onFinishHydration(() => setHydrated(true));
        return () => { unsubFinish(); };
    }, []);

    return hydrated;
}
