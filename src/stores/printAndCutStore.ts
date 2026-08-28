import { create } from 'zustand';
import type { Selection } from '@heroui/react';
import { CARD_DIMENSIONS, type CardImage, type ImageSource } from '../types/card';
import { CARDS_PER_PAGE } from '../utils/pdf/cardLayoutUtils';

export const PAGE_SIZE_OPTIONS = [
    { key: "A4", label: "A4", width: 210, height: 297 },
    { key: "Letter", label: "Letter", width: 215.9, height: 279.4 }
] as const;

interface PrintAndCutState {
    // Card state
    cardMap: Map<string, CardImage>;
    cardOrder: string[];

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
    defaultCardBack: ImageSource | null;
    defaultCardBackThumbnailUrl: string | null;
    groupByCardBacks: boolean;
    showAllCardBacks: boolean;

    // Skip slots settings
    skipSlots: Set<number>;

    // Card actions
    setCardMap: (map: Map<string, CardImage> | ((prev: Map<string, CardImage>) => Map<string, CardImage>)) => void;
    setCardOrder: (order: string[] | ((prev: string[]) => string[])) => void;

    // Settings actions
    setPageSize: (size: Selection) => void;
    setCardWidth: (width: number) => void;
    setCardHeight: (height: number) => void;
    setDefaultBleed: (bleed: number) => void;
    setDefaultCardBackBleed: (bleed: number) => void;
    setOutputBleed: (bleed: number) => void;
    setEnableCardBacks: (enabled: boolean) => void;
    setDefaultCardBack: (source: ImageSource | null) => void;
    setDefaultCardBackThumbnailUrl: (url: string | null) => void;
    setGroupByCardBacks: (group: boolean) => void;
    setShowAllCardBacks: (show: boolean) => void;
    setSkipSlots: (slots: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
    toggleSkipSlot: (slotIndex: number) => void;
}

export const usePrintAndCutStore = create<PrintAndCutState>((set) => ({
    // Card state
    cardMap: new Map(),
    cardOrder: [],

    // Initial settings state
    pageSize: new Set(["A4"]),
    cardWidth: CARD_DIMENSIONS.width,
    cardHeight: CARD_DIMENSIONS.height,
    defaultBleed: CARD_DIMENSIONS.standardBleed,
    defaultCardBackBleed: CARD_DIMENSIONS.standardBleed,
    outputBleed: CARD_DIMENSIONS.outputBleed,
    enableCardBacks: false,
    defaultCardBack: null,
    defaultCardBackThumbnailUrl: null,
    groupByCardBacks: false,
    showAllCardBacks: false,
    skipSlots: new Set(),

    // Card actions
    setCardMap: (map) => set((state) => ({
        cardMap: typeof map === 'function' ? map(state.cardMap) : map
    })),
    setCardOrder: (order) => set((state) => ({
        cardOrder: typeof order === 'function' ? order(state.cardOrder) : order
    })),

    // Settings actions
    setPageSize: (size) => set({ pageSize: size }),
    setCardWidth: (width) => set({ cardWidth: width }),
    setCardHeight: (height) => set({ cardHeight: height }),
    setDefaultBleed: (bleed) => set({ defaultBleed: bleed }),
    setDefaultCardBackBleed: (bleed) => set({ defaultCardBackBleed: bleed }),
    setOutputBleed: (bleed) => set({ outputBleed: bleed }),
    setEnableCardBacks: (enabled) => set({ enableCardBacks: enabled }),
    setDefaultCardBack: (source) => set({ defaultCardBack: source }),
    setDefaultCardBackThumbnailUrl: (url) => set({ defaultCardBackThumbnailUrl: url }),
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
            // Validate: ensure at least 1 slot per page is not skipped
            if (newSkipSlots.size >= CARDS_PER_PAGE - 1) {
                // Already skipping 7 slots, can't skip the 8th
                console.warn(`Cannot skip slot ${slotIndex}: at least 1 slot per page must remain active`);
                return state; // Return unchanged state
            }
            newSkipSlots.add(slotIndex);
        }
        return { skipSlots: newSkipSlots };
    }),
}));
