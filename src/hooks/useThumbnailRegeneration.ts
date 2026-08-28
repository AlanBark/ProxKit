import { useEffect, useRef } from "react";
import { useProjectSettingsStore, useProjectSettingsHydrated } from "../stores/projectSettingsStore";
import { useAppSettingsStore } from "../stores/appSettingsStore";
import { useCardStore } from "../stores/cardStore";
import { getThumbnail } from "../utils/thumbnails";
import { revokeSource } from "../utils/imageSource";

/**
 * Watches for changes to default bleed settings and regenerates thumbnails
 * for cards that don't have custom bleed values
 */
export function useThumbnailRegeneration() {
    const cardMap = useCardStore((state) => state.cardMap);
    const libraryFolder = useAppSettingsStore((state) => state.libraryFolder);
    const cardOrder = useCardStore((state) => state.cardOrder);
    const setCardMap = useCardStore((state) => state.setCardMap);
    const defaultBleed = useProjectSettingsStore((state) => state.defaultBleed);
    const defaultCardBackBleed = useProjectSettingsStore((state) => state.defaultCardBackBleed);
    const cardWidth = useProjectSettingsStore((state) => state.cardWidth);
    const cardHeight = useProjectSettingsStore((state) => state.cardHeight);
    const defaultCardBack = useProjectSettingsStore((state) => state.defaultCardBack);
    const setDefaultCardBackThumbnail = useCardStore((state) => state.setDefaultCardBackThumbnail);

    const prevDefaultBleedRef = useRef<number>(defaultBleed);
    const prevDefaultCardBackBleedRef = useRef<number>(defaultCardBackBleed);

    // Stored settings arrive after the first render, so the defaults-to-stored
    // change must be adopted as the baseline rather than acted on.
    const hydrated = useProjectSettingsHydrated();

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

                const newThumbnailUrl = await getThumbnail(card.image, { bleed: defaultBleed, cardWidth: cardWidth, cardHeight: cardHeight }, libraryFolder);

                revokeSource(card.thumbnail);

                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const currentCard = newMap.get(card.id);
                    if (currentCard && !currentCard.useCustomBleed) {
                        newMap.set(card.id, {
                            ...currentCard,
                            thumbnail: newThumbnailUrl,
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
    }, [libraryFolder, hydrated, defaultBleed, cardWidth, cardHeight, cardOrder, cardMap, setCardMap]);

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

                const newThumbnailUrl = await getThumbnail(card.cardBack, { bleed: defaultCardBackBleed, cardWidth: cardWidth, cardHeight: cardHeight }, libraryFolder);

                revokeSource(card.cardBackThumbnail);

                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const currentCard = newMap.get(card.id);
                    if (currentCard && !currentCard.useCustomCardBackBleed) {
                        newMap.set(card.id, {
                            ...currentCard,
                            cardBackThumbnail: newThumbnailUrl,
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
    }, [libraryFolder, hydrated, defaultCardBackBleed, cardWidth, cardHeight, cardOrder, cardMap, setCardMap]);

    // Regenerate default card back thumbnail when defaultCardBackBleed changes
    useEffect(() => {
        if (!defaultCardBack) return;

        const regenerateDefaultCardBackThumbnail = async () => {
            try {
                const newThumbnailUrl = await getThumbnail(defaultCardBack, { bleed: defaultCardBackBleed, cardWidth: cardWidth, cardHeight: cardHeight }, libraryFolder);

                setDefaultCardBackThumbnail(newThumbnailUrl);
            } catch (error) {
                console.error('Failed to regenerate default card back thumbnail:', error);
            }
        };

        regenerateDefaultCardBackThumbnail();
    }, [libraryFolder, defaultCardBackBleed, cardWidth, cardHeight, defaultCardBack, setDefaultCardBackThumbnail]);
}
