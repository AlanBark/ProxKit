import { useCallback } from "react";
import { useProjectSettingsStore } from "../stores/projectSettingsStore";
import { useCardStore } from "../stores/cardStore";
import { generateThumbnailAsync } from "../utils/asyncThumbnailGeneration";
import { revokeSource } from "../utils/imageSource";
import type { ImageSource } from "../types/card";

export function useCardBackManagement() {
    const cardMap = useCardStore((state) => state.cardMap);
    const setCardMap = useCardStore((state) => state.setCardMap);
    const defaultCardBack = useProjectSettingsStore((state) => state.defaultCardBack);
    const setDefaultCardBack = useProjectSettingsStore((state) => state.setDefaultCardBack);
    const defaultCardBackThumbnailUrl = useCardStore((state) => state.defaultCardBackThumbnailUrl);
    const setDefaultCardBackThumbnailUrl = useCardStore((state) => state.setDefaultCardBackThumbnailUrl);
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
        if (card.cardBackThumbnailUrl) {
            URL.revokeObjectURL(card.cardBackThumbnailUrl);
        }

        if (!source) {
            setCardMap((prev) => {
                const newMap = new Map(prev);
                newMap.set(cardId, {
                    ...card,
                    cardBack: undefined,
                    cardBackThumbnailUrl: undefined,
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
                cardBackThumbnailUrl: undefined,
                cardBackThumbnailLoading: true,
            });
            return newMap;
        });

        try {
            const cardBackThumbnailUrl = await generateThumbnailAsync(
                source, 800, 800, 0.85, defaultCardBackBleed, cardWidth, cardHeight
            );
            setCardMap((prev) => {
                const currentCard = prev.get(cardId);
                if (!currentCard) return prev;
                const newMap = new Map(prev);
                newMap.set(cardId, { ...currentCard, cardBackThumbnailUrl, cardBackThumbnailLoading: false });
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
    }, [cardMap, defaultCardBackBleed, cardWidth, cardHeight, setCardMap]);

    /** Sets or clears the back image used by every card without its own. */
    const handleUpdateDefaultCardBack = useCallback(async (source: ImageSource | null) => {
        revokeSource(defaultCardBack);
        if (defaultCardBackThumbnailUrl) {
            URL.revokeObjectURL(defaultCardBackThumbnailUrl);
        }

        if (!source) {
            setDefaultCardBack(null);
            setDefaultCardBackThumbnailUrl(null);
            return;
        }

        setDefaultCardBack(source);
        setDefaultCardBackThumbnailUrl(null);

        try {
            const thumbnailUrl = await generateThumbnailAsync(
                source, 800, 800, 0.85, defaultCardBackBleed, cardWidth, cardHeight
            );
            setDefaultCardBackThumbnailUrl(thumbnailUrl);
        } catch (error) {
            console.error('Failed to generate default card back thumbnail:', error);
        }
    }, [
        defaultCardBack,
        defaultCardBackThumbnailUrl,
        defaultCardBackBleed,
        cardWidth,
        cardHeight,
        setDefaultCardBack,
        setDefaultCardBackThumbnailUrl,
    ]);

    return { handleUpdateCardBack, handleUpdateDefaultCardBack };
}
