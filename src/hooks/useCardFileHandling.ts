import { useCallback, type RefObject } from "react";
import { useProjectSettingsStore } from "../stores/projectSettingsStore";
import { useCardStore } from "../stores/cardStore";
import { sourceFromFile } from "../utils/imageSource";
import { pickImagesFromDisk, sourceDisplayName } from "../utils/imagePicker";
import { isTauri } from "../utils/platform";
import type { CardImage, ImageSource } from "../types/card";

export function useCardFileHandling() {
    const setCardMap = useCardStore((state) => state.setCardMap);
    const setCardOrder = useCardStore((state) => state.setCardOrder);
    const defaultBleed = useProjectSettingsStore((state) => state.defaultBleed);
    const defaultCardBackBleed = useProjectSettingsStore((state) => state.defaultCardBackBleed);

    /**
     * Adds cards from already-resolved image sources. Both the desktop (paths)
     * and web (blob) entry points funnel through here - they differ only in how
     * the source is built.
     *
     * Thumbnails are not rendered here: a card with an image and no matching
     * thumbnail key is stale by definition, which is what useThumbnailBackfill
     * looks for.
     */
    const addCards = useCallback((incoming: { source: ImageSource; name: string }[]) => {
        const newCards: CardImage[] = incoming.map(({ source, name }) => ({
            id: crypto.randomUUID(),
            image: source,
            thumbnail: undefined,
            thumbnailLoading: true,
            name,
            bleed: defaultBleed,
            useCustomBleed: false,
            cardBackBleed: defaultCardBackBleed,
            useCustomCardBackBleed: false,
        }));

        setCardMap((prev) => {
            const newMap = new Map(prev);
            newCards.forEach(card => newMap.set(card.id, card));
            return newMap;
        });

        setCardOrder((prev) => [...prev, ...newCards.map(card => card.id)]);
    }, [defaultBleed, defaultCardBackBleed, setCardMap, setCardOrder]);

    /** Desktop: the dialog hands back filesystem paths. */
    const handleSourcesSelected = useCallback((sources: ImageSource[]) => {
        addCards(sources.map((source, i) => ({
            source,
            name: sourceDisplayName(source, `Card ${i + 1}`),
        })));
    }, [addCards]);

    /** Web: the file input hands back File objects. */
    const handleFilesSelected = useCallback((files: File[]) => {
        addCards(files.map((file) => ({
            source: sourceFromFile(file),
            name: file.name,
        })));
    }, [addCards]);

    // Opens file selection - uses Tauri dialog or falls back to file input
    const openFileSelection = useCallback(async (fileInputRef: RefObject<HTMLInputElement | null>) => {
        if (isTauri) {
            const sources = await pickImagesFromDisk(true);
            if (sources.length > 0) {
                handleSourcesSelected(sources);
            }
        } else {
            fileInputRef.current?.click();
        }
    }, [handleSourcesSelected]);

    return { handleFilesSelected, openFileSelection };
}
