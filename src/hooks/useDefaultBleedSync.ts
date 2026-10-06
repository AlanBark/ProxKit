import { useEffect } from "react";
import { useCardStore } from "../stores/cardStore";
import { useProjectSettingsStore } from "../stores/projectSettingsStore";

/**
 * Pushes a changed default bleed onto the cards that never overrode it.
 *
 * `useCustomBleed` marks a card the user has set a bleed on by hand; those keep
 * what they were given. Everything else follows the setting, which is what
 * makes the default a default rather than just an initial value.
 *
 * Only `bleed` is written. The thumbnail follows on its own, because bleed is
 * part of the thumbnail key that useThumbnailBackfill compares.
 */
export function useDefaultBleedSync() {
    const setCardMap = useCardStore((state) => state.setCardMap);
    const defaultBleed = useProjectSettingsStore((state) => state.defaultBleed);
    const defaultCardBackBleed = useProjectSettingsStore((state) => state.defaultCardBackBleed);

    useEffect(() => {
        setCardMap((prev) => {
            const stale = [...prev.values()].filter((card) =>
                (!card.useCustomBleed && card.bleed !== defaultBleed) ||
                (!card.useCustomCardBackBleed && card.cardBackBleed !== defaultCardBackBleed)
            );
            if (stale.length === 0) return prev;

            const next = new Map(prev);
            for (const card of stale) {
                next.set(card.id, {
                    ...card,
                    bleed: card.useCustomBleed ? card.bleed : defaultBleed,
                    cardBackBleed: card.useCustomCardBackBleed ? card.cardBackBleed : defaultCardBackBleed,
                });
            }
            return next;
        });
    }, [defaultBleed, defaultCardBackBleed, setCardMap]);
}
