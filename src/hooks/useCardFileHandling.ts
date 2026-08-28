import { useCallback, type RefObject } from "react";
import { useProjectSettingsStore } from "../stores/projectSettingsStore";
import { useAppSettingsStore } from "../stores/appSettingsStore";
import { useCardStore } from "../stores/cardStore";
import { getThumbnail } from "../utils/thumbnails";
import { revokeSource, sourceFromFile } from "../utils/imageSource";
import { pickImagesFromDisk, sourceDisplayName } from "../utils/imagePicker";
import { isTauri } from "../utils/platform";
import type { CardImage, ImageSource } from "../types/card";

export function useCardFileHandling() {
    const setCardMap = useCardStore((state) => state.setCardMap);
    const libraryFolder = useAppSettingsStore((state) => state.libraryFolder);
    const setCardOrder = useCardStore((state) => state.setCardOrder);
    const defaultBleed = useProjectSettingsStore((state) => state.defaultBleed);
    const defaultCardBackBleed = useProjectSettingsStore((state) => state.defaultCardBackBleed);
    const cardWidth = useProjectSettingsStore((state) => state.cardWidth);
    const cardHeight = useProjectSettingsStore((state) => state.cardHeight);

    /**
     * Adds cards from already-resolved image sources and kicks off thumbnail
     * generation for each. Both the desktop (paths) and web (blob) entry points
     * funnel through here - they differ only in how the source is built.
     */
    const addCards = useCallback(async (incoming: { source: ImageSource; name: string }[]) => {
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

        await Promise.all(newCards.map(async (card) => {
            let thumbnail: ImageSource | undefined;
            try {
                thumbnail = await getThumbnail(card.image!, { bleed: defaultBleed, cardWidth: cardWidth, cardHeight: cardHeight }, libraryFolder);
            } catch (error) {
                console.warn('Failed to create thumbnail for', card.name, ':', error);
            }

            let orphaned = false;
            setCardMap((prev) => {
                const existingCard = prev.get(card.id);
                if (!existingCard) {
                    // Card was removed while its thumbnail was being generated.
                    orphaned = true;
                    return prev;
                }
                const newMap = new Map(prev);
                newMap.set(card.id, { ...existingCard, thumbnail, thumbnailLoading: false });
                return newMap;
            });

            // Nothing owns the thumbnail now, so release it rather than leak.
            if (orphaned) {
                revokeSource(thumbnail);
            }
        }));
    }, [libraryFolder, defaultBleed, defaultCardBackBleed, cardWidth, cardHeight, setCardMap, setCardOrder]);

    /** Desktop: the dialog hands back filesystem paths. */
    const handleSourcesSelected = useCallback(async (sources: ImageSource[]) => {
        await addCards(sources.map((source, i) => ({
            source,
            name: sourceDisplayName(source, `Card ${i + 1}`),
        })));
    }, [addCards]);

    /** Web: the file input hands back File objects. */
    const handleFilesSelected = useCallback(async (files: File[]) => {
        await addCards(files.map((file) => ({
            source: sourceFromFile(file),
            name: file.name,
        })));
    }, [addCards]);

    // Opens file selection - uses Tauri dialog or falls back to file input
    const openFileSelection = useCallback(async (fileInputRef: RefObject<HTMLInputElement | null>) => {
        if (isTauri) {
            const sources = await pickImagesFromDisk(true);
            if (sources.length > 0) {
                await handleSourcesSelected(sources);
            }
        } else {
            fileInputRef.current?.click();
        }
    }, [handleSourcesSelected]);

    return { handleFilesSelected, openFileSelection };
}
