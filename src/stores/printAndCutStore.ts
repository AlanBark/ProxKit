import { create } from 'zustand';
import type { Selection } from '@heroui/react';
import { CARD_DIMENSIONS, type CardImage } from '../types/card';

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
    defaultCardBackUrl: string | null;
    defaultCardBackThumbnailUrl: string | null;
    groupByCardBacks: boolean;
    showAllCardBacks: boolean;

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
    setDefaultCardBackUrl: (url: string | null) => void;
    setDefaultCardBackThumbnailUrl: (url: string | null) => void;
    setGroupByCardBacks: (group: boolean) => void;
    setShowAllCardBacks: (show: boolean) => void;
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
    defaultCardBackUrl: null,
    defaultCardBackThumbnailUrl: null,
    groupByCardBacks: false,
    showAllCardBacks: false,

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
    setDefaultCardBackUrl: (url) => set({ defaultCardBackUrl: url }),
    setDefaultCardBackThumbnailUrl: (url) => set({ defaultCardBackThumbnailUrl: url }),
    setGroupByCardBacks: (group) => set({ groupByCardBacks: group }),
    setShowAllCardBacks: (show) => set({ showAllCardBacks: show }),
}));
