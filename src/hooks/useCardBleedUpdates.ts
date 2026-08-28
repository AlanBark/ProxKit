import { useCallback } from "react";
import { useProjectSettingsStore } from "../stores/projectSettingsStore";
import { useAppSettingsStore } from "../stores/appSettingsStore";
import { useCardStore } from "../stores/cardStore";
import { getThumbnail } from "../utils/thumbnails";
import type { CardImage, ImageSource } from "../types/card";
import { revokeSource } from "../utils/imageSource";

export function useCardBleedUpdates() {
    const cardMap = useCardStore((state) => state.cardMap);
    const libraryFolder = useAppSettingsStore((state) => state.libraryFolder);
    const setCardMap = useCardStore((state) => state.setCardMap);
    const cardWidth = useProjectSettingsStore((state) => state.cardWidth);
    const cardHeight = useProjectSettingsStore((state) => state.cardHeight);

    /**
     * Re-thumbnails one face of a card at a new bleed.
     *
     * `face` picks which set of fields to write; the source no longer needs a
     * platform branch because ImageSource resolves itself.
     */
    const updateBleed = useCallback(async (
        cardId: string,
        bleed: number,
        face: "front" | "back"
    ) => {
        const card = cardMap.get(cardId);
        if (!card) return;

        const isFront = face === "front";
        const source: ImageSource | undefined = isFront ? card.image : card.cardBack;

        const bleedField = isFront
            ? { bleed, useCustomBleed: true }
            : { cardBackBleed: bleed, useCustomCardBackBleed: true };
        const loadingField = (loading: boolean): Partial<CardImage> => isFront
            ? { thumbnailLoading: loading }
            : { cardBackThumbnailLoading: loading };

        // No image to re-thumbnail: record the bleed and stop.
        if (!source) {
            setCardMap((prev) => {
                const newMap = new Map(prev);
                newMap.set(cardId, { ...card, ...bleedField });
                return newMap;
            });
            return;
        }

        setCardMap((prev) => {
            const newMap = new Map(prev);
            newMap.set(cardId, { ...card, ...bleedField, ...loadingField(true) });
            return newMap;
        });

        try {
            const newThumbnailUrl = await getThumbnail(source, { bleed: bleed, cardWidth: cardWidth, cardHeight: cardHeight }, libraryFolder);

            revokeSource(isFront ? card.thumbnail : card.cardBackThumbnail);

            setCardMap((prev) => {
                const currentCard = prev.get(cardId);
                if (!currentCard) return prev;
                const newMap = new Map(prev);
                newMap.set(cardId, {
                    ...currentCard,
                    ...(isFront
                        ? { thumbnail: newThumbnailUrl, thumbnailLoading: false }
                        : { cardBackThumbnail: newThumbnailUrl, cardBackThumbnailLoading: false }),
                });
                return newMap;
            });
        } catch (error) {
            console.error(`Failed to regenerate ${face} thumbnail with new bleed:`, error);
            setCardMap((prev) => {
                const currentCard = prev.get(cardId);
                if (!currentCard) return prev;
                const newMap = new Map(prev);
                newMap.set(cardId, { ...currentCard, ...loadingField(false) });
                return newMap;
            });
        }
    }, [libraryFolder, cardMap, cardWidth, cardHeight, setCardMap]);

    const handleUpdateBleed = useCallback(
        (cardId: string, bleed: number) => updateBleed(cardId, bleed, "front"),
        [updateBleed]
    );

    const handleUpdateCardBackBleed = useCallback(
        (cardId: string, bleed: number) => updateBleed(cardId, bleed, "back"),
        [updateBleed]
    );

    return { handleUpdateBleed, handleUpdateCardBackBleed };
}
