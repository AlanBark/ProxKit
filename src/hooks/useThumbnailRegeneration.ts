import { useEffect, useRef } from "react";
import { useSettingsStore, useSettingsHydrated } from "../stores/settingsStore";
import { useCardStore } from "../stores/cardStore";
import { generateThumbnailAsync } from "../utils/asyncThumbnailGeneration";

/**
 * Watches for changes to default bleed settings and regenerates thumbnails
 * for cards that don't have custom bleed values
 */
export function useThumbnailRegeneration() {
    const cardMap = useCardStore((state) => state.cardMap);
    const cardOrder = useCardStore((state) => state.cardOrder);
    const setCardMap = useCardStore((state) => state.setCardMap);
    const defaultBleed = useSettingsStore((state) => state.defaultBleed);
    const defaultCardBackBleed = useSettingsStore((state) => state.defaultCardBackBleed);
    const cardWidth = useSettingsStore((state) => state.cardWidth);
    const cardHeight = useSettingsStore((state) => state.cardHeight);
    const defaultCardBack = useSettingsStore((state) => state.defaultCardBack);
    const setDefaultCardBackThumbnailUrl = useCardStore((state) => state.setDefaultCardBackThumbnailUrl);

    const prevDefaultBleedRef = useRef<number>(defaultBleed);
    const prevDefaultCardBackBleedRef = useRef<number>(defaultCardBackBleed);

    // Stored settings arrive after the first render, so the defaults-to-stored
    // change must be adopted as the baseline rather than acted on.
    const hydrated = useSettingsHydrated();

    // Regenerate front thumbnails when defaultBleed changes
    useEffect(() => {
        if (!hydrated) {
            prevDefaultBleedRef.current = defaultBleed;
            return;
        }
        if (cardOrder.length === 0) return;

        const prevBleed = prevDefaultBleedRef.current;
        if (prevBleed === defaultBleed) return;

        const cardsToUpdate = cardOrder
            .map(id => cardMap.get(id))
            .filter((card) => card !== undefined && !card.useCustomBleed);

        prevDefaultBleedRef.current = defaultBleed;

        cardsToUpdate.forEach(async (card) => {
            if (!card?.image) return;

            try {
                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const currentCard = newMap.get(card.id);
                    if (currentCard && !currentCard.useCustomBleed) {
                        newMap.set(card.id, { ...currentCard, bleed: defaultBleed, thumbnailLoading: true });
                    }
                    return newMap;
                });

                const newThumbnailUrl = await generateThumbnailAsync(
                    card.image,
                    800,
                    800,
                    0.85,
                    defaultBleed,
                    cardWidth,
                    cardHeight
                );

                if (card.thumbnailUrl) {
                    URL.revokeObjectURL(card.thumbnailUrl);
                }

                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const currentCard = newMap.get(card.id);
                    if (currentCard && !currentCard.useCustomBleed) {
                        newMap.set(card.id, {
                            ...currentCard,
                            thumbnailUrl: newThumbnailUrl,
                            thumbnailLoading: false
                        });
                    }
                    return newMap;
                });
            } catch (error) {
                console.error('Failed to regenerate thumbnail:', error);
                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const currentCard = newMap.get(card.id);
                    if (currentCard) {
                        newMap.set(card.id, { ...currentCard, thumbnailLoading: false });
                    }
                    return newMap;
                });
            }
        });
    }, [hydrated, defaultBleed, cardWidth, cardHeight, cardOrder, cardMap, setCardMap]);

    // Regenerate back thumbnails when defaultCardBackBleed changes
    useEffect(() => {
        if (!hydrated) {
            prevDefaultCardBackBleedRef.current = defaultCardBackBleed;
            return;
        }
        if (cardOrder.length === 0) return;

        const prevCardBackBleed = prevDefaultCardBackBleedRef.current;
        if (prevCardBackBleed === defaultCardBackBleed) return;

        const cardsToUpdate = cardOrder
            .map(id => cardMap.get(id))
            .filter((card) =>
                card !== undefined &&
                !card.useCustomCardBackBleed &&
                card.cardBack !== undefined
            );

        prevDefaultCardBackBleedRef.current = defaultCardBackBleed;

        cardsToUpdate.forEach(async (card) => {
            if (!card?.cardBack) return;

            try {
                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const currentCard = newMap.get(card.id);
                    if (currentCard && !currentCard.useCustomCardBackBleed) {
                        newMap.set(card.id, { ...currentCard, cardBackBleed: defaultCardBackBleed, cardBackThumbnailLoading: true });
                    }
                    return newMap;
                });

                const newThumbnailUrl = await generateThumbnailAsync(
                    card.cardBack,
                    800,
                    800,
                    0.85,
                    defaultCardBackBleed,
                    cardWidth,
                    cardHeight
                );

                if (card.cardBackThumbnailUrl) {
                    URL.revokeObjectURL(card.cardBackThumbnailUrl);
                }

                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const currentCard = newMap.get(card.id);
                    if (currentCard && !currentCard.useCustomCardBackBleed) {
                        newMap.set(card.id, {
                            ...currentCard,
                            cardBackThumbnailUrl: newThumbnailUrl,
                            cardBackThumbnailLoading: false
                        });
                    }
                    return newMap;
                });
            } catch (error) {
                console.error('Failed to regenerate card back thumbnail:', error);
                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const currentCard = newMap.get(card.id);
                    if (currentCard) {
                        newMap.set(card.id, { ...currentCard, cardBackThumbnailLoading: false });
                    }
                    return newMap;
                });
            }
        });
    }, [hydrated, defaultCardBackBleed, cardWidth, cardHeight, cardOrder, cardMap, setCardMap]);

    // Regenerate default card back thumbnail when defaultCardBackBleed changes
    useEffect(() => {
        if (!defaultCardBack) return;

        const regenerateDefaultCardBackThumbnail = async () => {
            try {
                const newThumbnailUrl = await generateThumbnailAsync(
                    defaultCardBack,
                    800,
                    800,
                    0.85,
                    defaultCardBackBleed,
                    cardWidth,
                    cardHeight
                );

                setDefaultCardBackThumbnailUrl(newThumbnailUrl);
            } catch (error) {
                console.error('Failed to regenerate default card back thumbnail:', error);
            }
        };

        regenerateDefaultCardBackThumbnail();
    }, [defaultCardBackBleed, cardWidth, cardHeight, defaultCardBack, setDefaultCardBackThumbnailUrl]);
}
