import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Selection } from '@heroui/react';
import { CARD_DIMENSIONS, type ImageSource } from '../types/card';
import { CARDS_PER_PAGE } from '../utils/pdf/cardLayoutUtils';
import { createSettingsStorage } from './settingsStorage';
import { settingsReplacer, settingsReviver } from './settingsSerialization';
import { useStoreHydrated } from './useStoreHydrated';

export const PAGE_SIZE_OPTIONS = [
    { key: "A4", label: "A4", width: 210, height: 297 },
    { key: "Letter", label: "Letter", width: 215.9, height: 279.4 }
] as const;

/**
 * The settings a preset fixes: the card itself.
 *
 * Page size is deliberately not included - the same cards are printed on
 * whatever paper is loaded, so that stays a separate choice. Workflow state
 * (whether backs are enabled, how the preview is grouped) and skipped slots
 * describe a job or a printer rather than a card, and are also excluded.
 */
export interface PresetValues {
    cardWidth: number;
    cardHeight: number;
    defaultBleed: number;
    defaultCardBackBleed: number;
    outputBleed: number;
}

/**
 * Settings that describe the current print job.
 *
 * These are properties of what is being printed rather than of the install, so
 * they are the things a saved project would eventually carry. Machine-level
 * preferences belong in appSettingsStore.
 *
 * Everything in this store is persisted - that is the point of it being a
 * separate store. Session state (the card list, generated thumbnails, blob
 * URLs) lives in cardStore and is deliberately not persisted, so there is no
 * list of exceptions to keep in sync.
 */
interface ProjectSettingsState {
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
    /** Applies a preset's format in one update. */
    applyPreset: (values: PresetValues) => void;
}

export const useProjectSettingsStore = create<ProjectSettingsState>()(
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

            // A page always has a size. Selection widgets can hand back an empty
            // set when the current item is re-picked, which would otherwise leave
            // the project with no page at all.
            setPageSize: (size) =>
                set((state) =>
                    size !== "all" && size.size === 0 ? state : { pageSize: size }
                ),
            setCardWidth: (width) => set({ cardWidth: width }),
            setCardHeight: (height) => set({ cardHeight: height }),
            setDefaultBleed: (bleed) => set({ defaultBleed: bleed }),
            setDefaultCardBackBleed: (bleed) => set({ defaultCardBackBleed: bleed }),
            setOutputBleed: (bleed) => set({ outputBleed: bleed }),
            setEnableCardBacks: (enabled) => set({ enableCardBacks: enabled }),
            setDefaultCardBack: (source) => set({ defaultCardBack: source }),
            setGroupByCardBacks: (group) => set({ groupByCardBacks: group }),
            setShowAllCardBacks: (show) => set({ showAllCardBacks: show }),
            applyPreset: (values) => set({
                cardWidth: values.cardWidth,
                cardHeight: values.cardHeight,
                defaultBleed: values.defaultBleed,
                defaultCardBackBleed: values.defaultCardBackBleed,
                outputBleed: values.outputBleed,
            }),
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
        }),
        {
            name: 'proxkit-project-settings',
            version: 1,
            storage: createJSONStorage(() => createSettingsStorage('project-settings.json'), {
                replacer: settingsReplacer,
                reviver: settingsReviver,
            }),
        }
    )
);

export function useProjectSettingsHydrated(): boolean {
    return useStoreHydrated(useProjectSettingsStore);
}
