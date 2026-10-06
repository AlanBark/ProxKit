import { useCallback } from "react";
import { useProjectSettingsStore } from "../stores/projectSettingsStore";
import { useCardStore } from "../stores/cardStore";
import { revokeSource } from "../utils/imageSource";
import type { ImageSource } from "../types/card";

/**
 * Sets and clears back images.
 *
 * Neither handler renders a thumbnail. Storing the source is enough: it leaves
 * the thumbnail key not matching the source, which is what useThumbnailBackfill
 * treats as stale.
 */
export function useCardBackManagement() {
    const setCardMap = useCardStore((state) => state.setCardMap);
    const defaultCardBack = useProjectSettingsStore((state) => state.defaultCardBack);
    const setDefaultCardBack = useProjectSettingsStore((state) => state.setDefaultCardBack);
    const defaultCardBackThumbnail = useCardStore((state) => state.defaultCardBackThumbnail);
    const setDefaultCardBackThumbnail = useCardStore((state) => state.setDefaultCardBackThumbnail);

    /**
     * Sets or clears this card's own back image.
     *
     * Takes an ImageSource rather than a File so that desktop callers can pass a
     * path from the native dialog. Passing a blob source on desktop is legal but
     * that card cannot be rendered by the Rust backend until it has been written
     * to the image library.
     */
    const handleUpdateCardBack = useCallback((cardId: string, source: ImageSource | null) => {
        setCardMap((prev) => {
            const card = prev.get(cardId);
            if (!card) return prev;

            // Release whatever the card was holding before.
            revokeSource(card.cardBack);
            revokeSource(card.cardBackThumbnail);

            const next = new Map(prev);
            next.set(cardId, {
                ...card,
                cardBack: source ?? undefined,
                cardBackThumbnail: undefined,
                cardBackThumbnailKey: undefined,
                cardBackThumbnailLoading: source !== null,
            });
            return next;
        });
    }, [setCardMap]);

    /** Sets or clears the back image used by every card without its own. */
    const handleUpdateDefaultCardBack = useCallback((source: ImageSource | null) => {
        revokeSource(defaultCardBack);
        revokeSource(defaultCardBackThumbnail);

        setDefaultCardBack(source);
        setDefaultCardBackThumbnail(null);
    }, [defaultCardBack, defaultCardBackThumbnail, setDefaultCardBack, setDefaultCardBackThumbnail]);

    return { handleUpdateCardBack, handleUpdateDefaultCardBack };
}
