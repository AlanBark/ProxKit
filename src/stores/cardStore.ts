import { create } from 'zustand';
import type { CardImage, ImageSource } from '../types/card';

/**
 * The working card list and anything derived from it.
 *
 * Deliberately not persisted: cards reference blob URLs that die with the
 * session, and restoring a card list is a project-file concern rather than a
 * setting. User preferences live in settingsStore.
 */
interface CardState {
    cardMap: Map<string, CardImage>;
    cardOrder: string[];

    /** Thumbnail for the default card back. Derived, so not persisted. */
    defaultCardBackThumbnail: ImageSource | null;

    setCardMap: (map: Map<string, CardImage> | ((prev: Map<string, CardImage>) => Map<string, CardImage>)) => void;
    setCardOrder: (order: string[] | ((prev: string[]) => string[])) => void;
    setDefaultCardBackThumbnail: (source: ImageSource | null) => void;
}

export const useCardStore = create<CardState>((set) => ({
    cardMap: new Map(),
    cardOrder: [],
    defaultCardBackThumbnail: null,

    setCardMap: (map) => set((state) => ({
        cardMap: typeof map === 'function' ? map(state.cardMap) : map
    })),
    setCardOrder: (order) => set((state) => ({
        cardOrder: typeof order === 'function' ? order(state.cardOrder) : order
    })),
    setDefaultCardBackThumbnail: (source) => set({ defaultCardBackThumbnail: source }),
}));
