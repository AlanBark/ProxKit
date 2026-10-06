import { useCallback } from "react";
import { useCardStore } from "../stores/cardStore";

export function useCardBleedUpdates() {
    const setCardMap = useCardStore((state) => state.setCardMap);

    /**
     * Records a new bleed for one face of a card.
     *
     * Nothing is re-rendered here. Bleed is part of a thumbnail's key, so
     * writing it is already enough to mark the thumbnail stale, and
     * useThumbnailBackfill picks it up - the same path a card size or default
     * bleed change goes through.
     */
    const updateBleed = useCallback((
        cardId: string,
        bleed: number,
        face: "front" | "back"
    ) => {
        setCardMap((prev) => {
            const card = prev.get(cardId);
            if (!card) return prev;

            const next = new Map(prev);
            next.set(cardId, face === "front"
                ? { ...card, bleed, useCustomBleed: true }
                : { ...card, cardBackBleed: bleed, useCustomCardBackBleed: true });
            return next;
        });
    }, [setCardMap]);

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
