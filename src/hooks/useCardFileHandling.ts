import { useCallback, type RefObject } from "react";
import { usePrintAndCutStore } from "../stores/printAndCutStore";
import { generateThumbnailAsync } from "../utils/asyncThumbnailGeneration";
import { sourceFromFile } from "../utils/imageSource";
import { pickImagesFromDisk, sourceDisplayName } from "../utils/imagePicker";
import { isTauri } from "../utils/platform";
import type { CardImage, ImageSource } from "../types/card";

export function useCardFileHandling() {
    const setCardMap = usePrintAndCutStore((state) => state.setCardMap);
    const setCardOrder = usePrintAndCutStore((state) => state.setCardOrder);
    const defaultBleed = usePrintAndCutStore((state) => state.defaultBleed);
    const defaultCardBackBleed = usePrintAndCutStore((state) => state.defaultCardBackBleed);
    const cardWidth = usePrintAndCutStore((state) => state.cardWidth);
    const cardHeight = usePrintAndCutStore((state) => state.cardHeight);

    /**
     * Adds cards from already-resolved image sources and kicks off thumbnail
     * generation for each. Both the desktop (paths) and web (blob) entry points
     * funnel through here - they differ only in how the source is built.
     */
    const addCards = useCallback(async (incoming: { source: ImageSource; name: string }[]) => {
        const newCards: CardImage[] = incoming.map(({ source, name }) => ({
            id: crypto.randomUUID(),
            image: source,
            thumbnailUrl: undefined,
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
            let thumbnailUrl: string | undefined;
            try {
                thumbnailUrl = await generateThumbnailAsync(
                    card.image!,
                    800,
                    800,
                    0.85,
                    defaultBleed,
                    cardWidth,
                    cardHeight
                );
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
                newMap.set(card.id, { ...existingCard, thumbnailUrl, thumbnailLoading: false });
                return newMap;
            });

            // Nothing owns the thumbnail now, so release it rather than leak.
            if (orphaned && thumbnailUrl) {
                URL.revokeObjectURL(thumbnailUrl);
            }
        }));
    }, [defaultBleed, defaultCardBackBleed, cardWidth, cardHeight, setCardMap, setCardOrder]);

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
