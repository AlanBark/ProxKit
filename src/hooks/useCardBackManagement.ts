import { useCallback } from "react";
import { useProjectSettingsStore } from "../stores/projectSettingsStore";
import { useAppSettingsStore } from "../stores/appSettingsStore";
import { useCardStore } from "../stores/cardStore";
import { getThumbnail } from "../utils/thumbnails";
import { revokeSource } from "../utils/imageSource";
import type { ImageSource } from "../types/card";

export function useCardBackManagement() {
    const cardMap = useCardStore((state) => state.cardMap);
    const libraryFolder = useAppSettingsStore((state) => state.libraryFolder);
    const setCardMap = useCardStore((state) => state.setCardMap);
    const defaultCardBack = useProjectSettingsStore((state) => state.defaultCardBack);
    const setDefaultCardBack = useProjectSettingsStore((state) => state.setDefaultCardBack);
    const defaultCardBackThumbnail = useCardStore((state) => state.defaultCardBackThumbnail);
    const setDefaultCardBackThumbnail = useCardStore((state) => state.setDefaultCardBackThumbnail);
    const defaultCardBackBleed = useProjectSettingsStore((state) => state.defaultCardBackBleed);
    const cardWidth = useProjectSettingsStore((state) => state.cardWidth);
    const cardHeight = useProjectSettingsStore((state) => state.cardHeight);

    /**
     * Sets or clears this card's own back image.
     *
     * Takes an ImageSource rather than a File so that desktop callers can pass a
     * path from the native dialog. Passing a blob source on desktop is legal but
     * that card cannot be rendered by the Rust backend until it has been written
     * to the image library.
     */
    const handleUpdateCardBack = useCallback(async (cardId: string, source: ImageSource | null) => {
        const card = cardMap.get(cardId);
        if (!card) return;

        // Release whatever the card was holding before.
        revokeSource(card.cardBack);
        revokeSource(card.cardBackThumbnail);

        if (!source) {
            setCardMap((prev) => {
                const newMap = new Map(prev);
                newMap.set(cardId, {
                    ...card,
                    cardBack: undefined,
                    cardBackThumbnail: undefined,
                    cardBackThumbnailLoading: false,
                });
                return newMap;
            });
            return;
        }

        setCardMap((prev) => {
            const newMap = new Map(prev);
            newMap.set(cardId, {
                ...card,
                cardBack: source,
                cardBackThumbnail: undefined,
                cardBackThumbnailLoading: true,
            });
            return newMap;
        });

        try {
            const cardBackThumbnail = await getThumbnail(source, { bleed: defaultCardBackBleed, cardWidth: cardWidth, cardHeight: cardHeight }, libraryFolder);
            setCardMap((prev) => {
                const currentCard = prev.get(cardId);
                if (!currentCard) return prev;
                const newMap = new Map(prev);
                newMap.set(cardId, { ...currentCard, cardBackThumbnail, cardBackThumbnailLoading: false });
                return newMap;
            });
        } catch (error) {
            console.error('Failed to generate card back thumbnail:', error);
            setCardMap((prev) => {
                const currentCard = prev.get(cardId);
                if (!currentCard) return prev;
                const newMap = new Map(prev);
                newMap.set(cardId, { ...currentCard, cardBackThumbnailLoading: false });
                return newMap;
            });
        }
    }, [libraryFolder, cardMap, defaultCardBackBleed, cardWidth, cardHeight, setCardMap]);

    /** Sets or clears the back image used by every card without its own. */
    const handleUpdateDefaultCardBack = useCallback(async (source: ImageSource | null) => {
        revokeSource(defaultCardBack);
        revokeSource(defaultCardBackThumbnail);

        if (!source) {
            setDefaultCardBack(null);
            setDefaultCardBackThumbnail(null);
            return;
        }

        setDefaultCardBack(source);
        setDefaultCardBackThumbnail(null);

        try {
            const thumbnail = await getThumbnail(source, { bleed: defaultCardBackBleed, cardWidth: cardWidth, cardHeight: cardHeight }, libraryFolder);
            setDefaultCardBackThumbnail(thumbnail);
        } catch (error) {
            console.error('Failed to generate default card back thumbnail:', error);
        }
    }, [libraryFolder, defaultCardBack,
        defaultCardBackThumbnail,
        defaultCardBackBleed,
        cardWidth,
        cardHeight,
        setDefaultCardBack,
        setDefaultCardBackThumbnail,]);

    return { handleUpdateCardBack, handleUpdateDefaultCardBack };
}
