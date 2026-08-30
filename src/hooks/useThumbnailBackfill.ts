import { useEffect, useRef } from "react";
import { useCardStore } from "../stores/cardStore";
import { useProjectSettingsStore } from "../stores/projectSettingsStore";
import { useAppSettingsStore } from "../stores/appSettingsStore";
import { getThumbnail } from "../utils/thumbnails";
import type { CardImage, ImageSource } from "../types/card";

type Face = "front" | "back";

/**
 * Generates thumbnails for any card that arrived without one.
 *
 * Thumbnails are derived and deliberately not saved, so a project loaded from
 * disk has cards with images but no previews. Rather than making every producer
 * of cards remember to generate them - which is how opening a project ended up
 * leaving every card spinning - this fills in whatever is missing, wherever the
 * cards came from.
 */
export function useThumbnailBackfill() {
    const cardMap = useCardStore((s) => s.cardMap);
    const setCardMap = useCardStore((s) => s.setCardMap);
    const cardWidth = useProjectSettingsStore((s) => s.cardWidth);
    const cardHeight = useProjectSettingsStore((s) => s.cardHeight);
    const libraryFolder = useAppSettingsStore((s) => s.libraryFolder);

    // Faces already handled this session. Never cleared: a face that failed
    // must not be retried on every store change, which would spin forever.
    const attempted = useRef(new Set<string>());

    // Only unmounting should abandon work in progress. Tying that to the effect
    // instead would cancel every pending thumbnail as soon as one finished,
    // because finishing writes to cardMap and so re-runs the effect.
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        const missing: { card: CardImage; face: Face; source: ImageSource; bleed: number }[] = [];

        for (const card of cardMap.values()) {
            if (card.image && !card.thumbnail && !attempted.current.has(`front:${card.id}`)) {
                missing.push({ card, face: "front", source: card.image, bleed: card.bleed });
            }
            if (card.cardBack && !card.cardBackThumbnail && !attempted.current.has(`back:${card.id}`)) {
                missing.push({
                    card,
                    face: "back",
                    source: card.cardBack,
                    bleed: card.cardBackBleed,
                });
            }
        }

        if (missing.length === 0) return;
        missing.forEach(({ card, face }) => attempted.current.add(`${face}:${card.id}`));

        void Promise.all(
            missing.map(async ({ card, face, source, bleed }) => {
                let thumbnail: ImageSource | undefined;
                try {
                    thumbnail = await getThumbnail(source, { bleed, cardWidth, cardHeight }, libraryFolder);
                } catch (error) {
                    console.warn(`Could not create a ${face} thumbnail for`, card.name, error);
                }
                if (!mounted.current) return;

                setCardMap((prev) => {
                    const current = prev.get(card.id);
                    if (!current) return prev;

                    const next = new Map(prev);
                    next.set(
                        card.id,
                        face === "front"
                            ? { ...current, thumbnail, thumbnailLoading: false }
                            : { ...current, cardBackThumbnail: thumbnail, cardBackThumbnailLoading: false }
                    );
                    return next;
                });
            })
        );
    }, [cardMap, cardWidth, cardHeight, libraryFolder, setCardMap]);
}
