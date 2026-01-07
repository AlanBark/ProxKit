import { useCallback } from "react";
import { usePrintAndCutStore } from "../stores/printAndCutStore";
import { generateThumbnailAsync } from "../utils/asyncThumbnailGeneration";
import type { CardImage } from "../types/card";

export function useCardFileHandling() {
    const setCardMap = usePrintAndCutStore((state) => state.setCardMap);
    const setCardOrder = usePrintAndCutStore((state) => state.setCardOrder);
    const defaultBleed = usePrintAndCutStore((state) => state.defaultBleed);
    const defaultCardBackBleed = usePrintAndCutStore((state) => state.defaultCardBackBleed);
    const cardWidth = usePrintAndCutStore((state) => state.cardWidth);
    const cardHeight = usePrintAndCutStore((state) => state.cardHeight);

    const handleFilesSelected = useCallback(async (files: File[]) => {
        const newCards: CardImage[] = files.map((file) => {
            const imageUrl = URL.createObjectURL(file);
            return {
                id: crypto.randomUUID(),
                imageUrl,
                thumbnailUrl: undefined,
                thumbnailLoading: true,
                name: file.name,
                bleed: defaultBleed,
                useCustomBleed: false,
                cardBackBleed: defaultCardBackBleed,
                useCustomCardBackBleed: false,
            };
        });

        // Add cards to map and order
        setCardMap((prev) => {
            const newMap = new Map(prev);
            newCards.forEach(card => newMap.set(card.id, card));
            return newMap;
        });

        setCardOrder((prev) => [...prev, ...newCards.map(card => card.id)]);

        // Generate thumbnails asynchronously
        newCards.forEach(async (card, index) => {
            const file = files[index];

            try {
                const thumbnailUrl = await generateThumbnailAsync(
                    file,
                    800,
                    800,
                    0.85,
                    defaultBleed,
                    cardWidth,
                    cardHeight
                );

                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const existingCard = newMap.get(card.id);
                    if (existingCard) {
                        newMap.set(card.id, {
                            ...existingCard,
                            thumbnailUrl,
                            thumbnailLoading: false
                        });
                    }
                    return newMap;
                });
            } catch (error) {
                console.warn('Failed to create thumbnail for', card.name, ':', error);
                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const existingCard = newMap.get(card.id);
                    if (existingCard) {
                        newMap.set(card.id, {
                            ...existingCard,
                            thumbnailLoading: false
                        });
                    }
                    return newMap;
                });
            }
        });
    }, [defaultBleed, defaultCardBackBleed, cardWidth, cardHeight, setCardMap, setCardOrder]);

    return { handleFilesSelected };
}
