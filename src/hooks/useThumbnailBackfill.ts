import { useEffect, useRef } from "react";
import { useCardStore } from "../stores/cardStore";
import { useProjectSettingsStore } from "../stores/projectSettingsStore";
import { useAppSettingsStore } from "../stores/appSettingsStore";
import { getThumbnail, thumbnailKeyFor } from "../utils/thumbnails";
import { revokeSource } from "../utils/imageSource";
import type { ImageSource } from "../types/card";

/** Which thumbnail a job is for. The default back lives outside the card map. */
type Target =
    | { kind: "card"; id: string; face: "front" | "back" }
    | { kind: "defaultBack" };

interface Job {
    target: Target;
    source: ImageSource;
    bleed: number;
    key: string;
    /** Only used in warnings. */
    label: string;
}

/**
 * Renders every thumbnail that does not match what it is meant to show.
 *
 * A thumbnail is a function of its source file, its bleed and the card
 * dimensions, so it is wrong the moment any of those changes. Rather than a
 * watcher per trigger - which missed card-size changes entirely, so switching
 * preset silently kept thumbnails cropped for the old card - this compares the
 * key each thumbnail was rendered with against the key it would get now, and
 * re-renders on a mismatch.
 *
 * That one comparison covers a card arriving without a thumbnail, a per-card
 * bleed edit, a change to the default bleed, and a change of card size. It is
 * also why the rest of the app only ever stores image sources: setting an
 * image is enough, because the mismatch is what schedules the render.
 */
export function useThumbnailBackfill() {
    const cardMap = useCardStore((s) => s.cardMap);
    const setCardMap = useCardStore((s) => s.setCardMap);
    const defaultCardBack = useProjectSettingsStore((s) => s.defaultCardBack);
    const defaultCardBackBleed = useProjectSettingsStore((s) => s.defaultCardBackBleed);
    const defaultCardBackThumbnailKey = useCardStore((s) => s.defaultCardBackThumbnailKey);
    const setDefaultCardBackThumbnail = useCardStore((s) => s.setDefaultCardBackThumbnail);
    const cardWidth = useProjectSettingsStore((s) => s.cardWidth);
    const cardHeight = useProjectSettingsStore((s) => s.cardHeight);
    const libraryFolder = useAppSettingsStore((s) => s.libraryFolder);

    // Keys already attempted this session, so a thumbnail that fails to render
    // is not retried on every store change. Keyed by the thumbnail key rather
    // than by the card, so a changed bleed or card size is a new key and does
    // get another go.
    const attempted = useRef(new Set<string>());

    // Only unmounting should abandon work in progress. Tying that to the effect
    // instead would cancel every pending thumbnail as soon as one finished,
    // because finishing writes to the store and so re-runs the effect.
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        const jobs: Job[] = [];

        const consider = (
            target: Target,
            source: ImageSource | undefined | null,
            bleed: number,
            renderedKey: string | undefined | null,
            label: string
        ) => {
            if (!source) return;
            const key = thumbnailKeyFor(source, { bleed, cardWidth, cardHeight });
            if (key === renderedKey || attempted.current.has(key)) return;
            jobs.push({ target, source, bleed, key, label });
        };

        // Read through the store rather than use the subscribed value: an effect
        // that ran earlier this commit may already have written to it, and
        // rendering against the value this closure captured would mean a
        // thumbnail at, say, the bleed that was just replaced.
        for (const card of useCardStore.getState().cardMap.values()) {
            const name = card.name ?? "card";
            consider({ kind: "card", id: card.id, face: "front" },
                card.image, card.bleed, card.thumbnailKey, name);
            consider({ kind: "card", id: card.id, face: "back" },
                card.cardBack, card.cardBackBleed, card.cardBackThumbnailKey, `${name} back`);
        }

        consider({ kind: "defaultBack" }, defaultCardBack, defaultCardBackBleed,
            defaultCardBackThumbnailKey, "default card back");

        if (jobs.length === 0) return;
        jobs.forEach(({ key }) => attempted.current.add(key));

        // Show the work as pending in one write, rather than one per thumbnail.
        const cardJobs = jobs.filter((job) => job.target.kind === "card");
        if (cardJobs.length > 0) {
            setCardMap((prev) => {
                const next = new Map(prev);
                for (const { target } of cardJobs) {
                    if (target.kind !== "card") continue;
                    const current = next.get(target.id);
                    if (!current) continue;
                    next.set(target.id, target.face === "front"
                        ? { ...current, thumbnailLoading: true }
                        : { ...current, cardBackThumbnailLoading: true });
                }
                return next;
            });
        }

        void Promise.all(jobs.map(async ({ target, source, bleed, key, label }) => {
            let rendered: ImageSource | undefined;
            try {
                const result = await getThumbnail(source, { bleed, cardWidth, cardHeight }, libraryFolder);
                rendered = result.thumbnail;
            } catch (error) {
                console.warn("Could not create a thumbnail for", label, error);
            }

            // The app has gone; nothing would own what we rendered.
            if (!mounted.current) {
                revokeSource(rendered);
                return;
            }

            if (target.kind === "defaultBack") {
                // Nothing was rendered, so leave whatever is on screen alone -
                // a stale preview beats no preview.
                if (!rendered) return;
                // Read through the store rather than the closure: the value may
                // have moved on while this was rendering.
                const previous = useCardStore.getState().defaultCardBackThumbnail;
                if (previous !== rendered) revokeSource(previous);
                setDefaultCardBackThumbnail(rendered, key);
                return;
            }

            setCardMap((prev) => {
                const current = prev.get(target.id);
                if (!current) {
                    // The card was removed while this was rendering.
                    revokeSource(rendered);
                    return prev;
                }

                // As above: on failure only the spinner is cleared, so the card
                // keeps showing the thumbnail it already had.
                const replacement = rendered
                    ? { thumbnail: rendered, key }
                    : undefined;

                if (replacement) {
                    // The thumbnail being replaced is no longer referenced.
                    const previous = target.face === "front" ? current.thumbnail : current.cardBackThumbnail;
                    if (previous !== replacement.thumbnail) revokeSource(previous);
                }

                const next = new Map(prev);
                next.set(target.id, target.face === "front"
                    ? {
                        ...current,
                        ...(replacement && { thumbnail: replacement.thumbnail, thumbnailKey: replacement.key }),
                        thumbnailLoading: false,
                    }
                    : {
                        ...current,
                        ...(replacement && {
                            cardBackThumbnail: replacement.thumbnail,
                            cardBackThumbnailKey: replacement.key,
                        }),
                        cardBackThumbnailLoading: false,
                    });
                return next;
            });
        }));
    }, [
        cardMap,
        defaultCardBack,
        defaultCardBackBleed,
        defaultCardBackThumbnailKey,
        setDefaultCardBackThumbnail,
        cardWidth,
        cardHeight,
        libraryFolder,
        setCardMap,
    ]);
}
