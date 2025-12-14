import { useEffect, useRef } from "react";
import { usePrintAndCutStore } from "../stores/printAndCutStore";
import { generateThumbnailAsync } from "../utils/asyncThumbnailGeneration";

/**
 * Watches for changes to default bleed settings and regenerates thumbnails
 * for cards that don't have custom bleed values
 */
export function useThumbnailRegeneration() {
    const cardMap = usePrintAndCutStore((state) => state.cardMap);
    const cardOrder = usePrintAndCutStore((state) => state.cardOrder);
    const setCardMap = usePrintAndCutStore((state) => state.setCardMap);
    const defaultBleed = usePrintAndCutStore((state) => state.defaultBleed);
    const defaultCardBackBleed = usePrintAndCutStore((state) => state.defaultCardBackBleed);
    const cardWidth = usePrintAndCutStore((state) => state.cardWidth);
    const cardHeight = usePrintAndCutStore((state) => state.cardHeight);
    const defaultCardBackUrl = usePrintAndCutStore((state) => state.defaultCardBackUrl);
    const setDefaultCardBackThumbnailUrl = usePrintAndCutStore((state) => state.setDefaultCardBackThumbnailUrl);

    const prevDefaultBleedRef = useRef<number>(defaultBleed);
    const prevDefaultCardBackBleedRef = useRef<number>(defaultCardBackBleed);
    const defaultCardBackFileRef = useRef<File | null>(null);

    // Regenerate front thumbnails when defaultBleed changes
    useEffect(() => {
        if (cardOrder.length === 0) return;

        const prevBleed = prevDefaultBleedRef.current;
        if (prevBleed === defaultBleed) return;

        const cardsToUpdate = cardOrder
            .map(id => cardMap.get(id))
            .filter((card) => card !== undefined && !card.useCustomBleed);

        prevDefaultBleedRef.current = defaultBleed;

        cardsToUpdate.forEach(async (card) => {
            try {
                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const currentCard = newMap.get(card.id);
                    if (currentCard && !currentCard.useCustomBleed) {
                        newMap.set(card.id, { ...currentCard, bleed: defaultBleed, thumbnailLoading: true });
                    }
                    return newMap;
                });

                const response = await fetch(card.imageUrl);
                const blob = await response.blob();
                const file = new File([blob], card.name || 'image.jpg', { type: blob.type });

                const newThumbnailUrl = await generateThumbnailAsync(
                    file,
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
    }, [defaultBleed, cardWidth, cardHeight, cardOrder, cardMap, setCardMap]);

    // Regenerate back thumbnails when defaultCardBackBleed changes
    useEffect(() => {
        if (cardOrder.length === 0) return;

        const prevCardBackBleed = prevDefaultCardBackBleedRef.current;
        if (prevCardBackBleed === defaultCardBackBleed) return;

        const cardsToUpdate = cardOrder
            .map(id => cardMap.get(id))
            .filter((card) =>
                card !== undefined &&
                !card.useCustomCardBackBleed &&
                card.cardBackUrl !== undefined
            );

        prevDefaultCardBackBleedRef.current = defaultCardBackBleed;

        cardsToUpdate.forEach(async (card) => {
            if (!card.cardBackUrl) return;

            try {
                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const currentCard = newMap.get(card.id);
                    if (currentCard && !currentCard.useCustomCardBackBleed) {
                        newMap.set(card.id, { ...currentCard, cardBackBleed: defaultCardBackBleed, cardBackThumbnailLoading: true });
                    }
                    return newMap;
                });

                const response = await fetch(card.cardBackUrl);
                const blob = await response.blob();
                const file = new File([blob], `${card.name || 'card'}-back.jpg`, { type: blob.type });

                const newThumbnailUrl = await generateThumbnailAsync(
                    file,
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
    }, [defaultCardBackBleed, cardWidth, cardHeight, cardOrder, cardMap, setCardMap]);

    // Regenerate default card back thumbnail when defaultCardBackBleed changes
    useEffect(() => {
        if (!defaultCardBackFileRef.current || !defaultCardBackUrl) return;

        const regenerateDefaultCardBackThumbnail = async () => {
            try {
                const file = defaultCardBackFileRef.current!;

                const newThumbnailUrl = await generateThumbnailAsync(
                    file,
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
    }, [defaultCardBackBleed, cardWidth, cardHeight, defaultCardBackUrl, setDefaultCardBackThumbnailUrl]);
}
