import { useCallback } from "react";
import { usePrintAndCutStore } from "../stores/printAndCutStore";
import { generateThumbnailAsync } from "../utils/asyncThumbnailGeneration";

export function useCardBackManagement() {
    const cardMap = usePrintAndCutStore((state) => state.cardMap);
    const setCardMap = usePrintAndCutStore((state) => state.setCardMap);
    const setDefaultCardBackUrl = usePrintAndCutStore((state) => state.setDefaultCardBackUrl);
    const setDefaultCardBackThumbnailUrl = usePrintAndCutStore((state) => state.setDefaultCardBackThumbnailUrl);
    const defaultCardBackBleed = usePrintAndCutStore((state) => state.defaultCardBackBleed);
    const cardWidth = usePrintAndCutStore((state) => state.cardWidth);
    const cardHeight = usePrintAndCutStore((state) => state.cardHeight);

    const handleUpdateCardBack = useCallback(async (cardId: string, file: File | null) => {
        const card = cardMap.get(cardId);
        if (!card) return;

        // Cleanup old URLs
        if (card.cardBackUrl) {
            URL.revokeObjectURL(card.cardBackUrl);
        }
        if (card.cardBackThumbnailUrl) {
            URL.revokeObjectURL(card.cardBackThumbnailUrl);
        }

        if (!file) {
            setCardMap((prev) => {
                const newMap = new Map(prev);
                newMap.set(cardId, {
                    ...card,
                    cardBackUrl: undefined,
                    cardBackThumbnailUrl: undefined,
                    cardBackThumbnailLoading: false
                });
                return newMap;
            });
            return;
        }

        const cardBackUrl = URL.createObjectURL(file);

        setCardMap((prev) => {
            const newMap = new Map(prev);
            newMap.set(cardId, {
                ...card,
                cardBackUrl,
                cardBackThumbnailLoading: true
            });
            return newMap;
        });

        try {
            const cardBackThumbnailUrl = await generateThumbnailAsync(
                file,
                800,
                800,
                0.85,
                card.cardBackBleed,
                cardWidth,
                cardHeight
            );

            setCardMap((prev) => {
                const newMap = new Map(prev);
                const currentCard = newMap.get(cardId);
                if (currentCard) {
                    newMap.set(cardId, {
                        ...currentCard,
                        cardBackThumbnailUrl,
                        cardBackThumbnailLoading: false
                    });
                }
                return newMap;
            });
        } catch (error) {
            console.error('Failed to generate card back thumbnail:', error);
            setCardMap((prev) => {
                const newMap = new Map(prev);
                const currentCard = newMap.get(cardId);
                if (currentCard) {
                    newMap.set(cardId, {
                        ...currentCard,
                        cardBackThumbnailLoading: false
                    });
                }
                return newMap;
            });
        }
    }, [cardMap, cardWidth, cardHeight, setCardMap]);

    const handleUpdateDefaultCardBack = useCallback(async (file: File | null) => {
        if (!file) {
            setDefaultCardBackUrl(null);
            setDefaultCardBackThumbnailUrl(null);
            return;
        }

        const cardBackUrl = URL.createObjectURL(file);
        setDefaultCardBackUrl(cardBackUrl);

        try {
            const thumbnailUrl = await generateThumbnailAsync(
                file,
                800,
                800,
                0.85,
                defaultCardBackBleed,
                cardWidth,
                cardHeight
            );

            setDefaultCardBackThumbnailUrl(thumbnailUrl);
        } catch (error) {
            console.error('Failed to generate default card back thumbnail:', error);
        }
    }, [defaultCardBackBleed, cardWidth, cardHeight, setDefaultCardBackUrl, setDefaultCardBackThumbnailUrl]);

    return { handleUpdateCardBack, handleUpdateDefaultCardBack };
}
