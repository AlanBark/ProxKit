import { useCallback } from "react";
import { usePrintAndCutStore } from "../stores/printAndCutStore";
import { generateThumbnailAsync } from "../utils/asyncThumbnailGeneration";

export function useCardBleedUpdates() {
    const cardMap = usePrintAndCutStore((state) => state.cardMap);
    const setCardMap = usePrintAndCutStore((state) => state.setCardMap);
    const cardWidth = usePrintAndCutStore((state) => state.cardWidth);
    const cardHeight = usePrintAndCutStore((state) => state.cardHeight);

    const handleUpdateBleed = useCallback(async (cardId: string, bleed: number) => {
        const card = cardMap.get(cardId);
        if (!card) return;

        // Set new bleed and mark as loading
        setCardMap((prev) => {
            const newMap = new Map(prev);
            newMap.set(cardId, { ...card, bleed, useCustomBleed: true, thumbnailLoading: true });
            return newMap;
        });

        try {
            const response = await fetch(card.imageUrl);
            const blob = await response.blob();
            const file = new File([blob], card.name || 'image.jpg', { type: blob.type });

            const newThumbnailUrl = await generateThumbnailAsync(
                file,
                800,
                800,
                0.85,
                bleed,
                cardWidth,
                cardHeight
            );

            if (card.thumbnailUrl) {
                URL.revokeObjectURL(card.thumbnailUrl);
            }

            setCardMap((prev) => {
                const newMap = new Map(prev);
                const currentCard = newMap.get(cardId);
                if (currentCard) {
                    newMap.set(cardId, {
                        ...currentCard,
                        thumbnailUrl: newThumbnailUrl,
                        thumbnailLoading: false
                    });
                }
                return newMap;
            });
        } catch (error) {
            console.error('Failed to regenerate thumbnail with new bleed:', error);
            setCardMap((prev) => {
                const newMap = new Map(prev);
                const currentCard = newMap.get(cardId);
                if (currentCard) {
                    newMap.set(cardId, { ...currentCard, thumbnailLoading: false });
                }
                return newMap;
            });
        }
    }, [cardMap, cardWidth, cardHeight, setCardMap]);

    const handleUpdateCardBackBleed = useCallback(async (cardId: string, bleed: number) => {
        const card = cardMap.get(cardId);
        if (!card) return;

        if (!card.cardBackUrl) {
            setCardMap((prev) => {
                const newMap = new Map(prev);
                newMap.set(cardId, { ...card, cardBackBleed: bleed, useCustomCardBackBleed: true });
                return newMap;
            });
            return;
        }

        setCardMap((prev) => {
            const newMap = new Map(prev);
            newMap.set(cardId, { ...card, cardBackBleed: bleed, useCustomCardBackBleed: true, cardBackThumbnailLoading: true });
            return newMap;
        });

        try {
            const response = await fetch(card.cardBackUrl);
            const blob = await response.blob();
            const file = new File([blob], `${card.name || 'card'}-back.jpg`, { type: blob.type });

            const newThumbnailUrl = await generateThumbnailAsync(
                file,
                800,
                800,
                0.85,
                bleed,
                cardWidth,
                cardHeight
            );

            if (card.cardBackThumbnailUrl) {
                URL.revokeObjectURL(card.cardBackThumbnailUrl);
            }

            setCardMap((prev) => {
                const newMap = new Map(prev);
                const currentCard = newMap.get(cardId);
                if (currentCard) {
                    newMap.set(cardId, {
                        ...currentCard,
                        cardBackThumbnailUrl: newThumbnailUrl,
                        cardBackThumbnailLoading: false
                    });
                }
                return newMap;
            });
        } catch (error) {
            console.error('Failed to regenerate card back thumbnail with new bleed:', error);
            setCardMap((prev) => {
                const newMap = new Map(prev);
                const currentCard = newMap.get(cardId);
                if (currentCard) {
                    newMap.set(cardId, { ...currentCard, cardBackThumbnailLoading: false });
                }
                return newMap;
            });
        }
    }, [cardMap, cardWidth, cardHeight, setCardMap]);

    return { handleUpdateBleed, handleUpdateCardBackBleed };
}
