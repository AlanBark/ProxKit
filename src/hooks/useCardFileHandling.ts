import { useCallback, type RefObject } from "react";
import { usePrintAndCutStore } from "../stores/printAndCutStore";
import { generateThumbnailAsync } from "../utils/asyncThumbnailGeneration";
import { generateThumbnailFromPath } from "../utils/tauriThumbnailGeneration";
import type { CardImage } from "../types/card";

const isTauri = !!(window as any).__TAURI_INTERNALS__;

export function useCardFileHandling() {
    const setCardMap = usePrintAndCutStore((state) => state.setCardMap);
    const setCardOrder = usePrintAndCutStore((state) => state.setCardOrder);
    const defaultBleed = usePrintAndCutStore((state) => state.defaultBleed);
    const defaultCardBackBleed = usePrintAndCutStore((state) => state.defaultCardBackBleed);
    const cardWidth = usePrintAndCutStore((state) => state.cardWidth);
    const cardHeight = usePrintAndCutStore((state) => state.cardHeight);

    // Handler for Tauri: receives full file system paths
    const handleFilePathsSelected = useCallback(async (filePaths: string[]) => {
        // Create cards with file paths
        const newCards: CardImage[] = filePaths.map((filePath) => {
            // Extract filename from path
            const name = filePath.split(/[/\\]/).pop() || filePath;
            return {
                id: crypto.randomUUID(),
                imageUrl: filePath, // Store the full file path
                thumbnailUrl: undefined,
                thumbnailLoading: true,
                name,
                bleed: defaultBleed,
                useCustomBleed: false,
                cardBackBleed: defaultCardBackBleed,
                useCustomCardBackBleed: false,
            };
        });

        // Add cards to map and order
        setCardMap((prev) => {
            const newMap = new Map(prev);
            newCards.forEach(card => newMap.set(card.id, card));
            return newMap;
        });

        setCardOrder((prev) => [...prev, ...newCards.map(card => card.id)]);

        // Generate thumbnails from file paths
        newCards.forEach(async (card) => {
            try {
                const thumbnailUrl = await generateThumbnailFromPath(
                    card.imageUrl,
                    800,
                    800,
                    0.85,
                    defaultBleed,
                    cardWidth,
                    cardHeight
                );

                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const existingCard = newMap.get(card.id);
                    if (existingCard) {
                        newMap.set(card.id, {
                            ...existingCard,
                            thumbnailUrl,
                            thumbnailLoading: false
                        });
                    }
                    return newMap;
                });
            } catch (error) {
                console.warn('Failed to create thumbnail for', card.name, ':', error);
                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const existingCard = newMap.get(card.id);
                    if (existingCard) {
                        newMap.set(card.id, {
                            ...existingCard,
                            thumbnailLoading: false
                        });
                    }
                    return newMap;
                });
            }
        });
    }, [defaultBleed, defaultCardBackBleed, cardWidth, cardHeight, setCardMap, setCardOrder]);

    // Handler for Web: receives File objects
    const handleFilesSelected = useCallback(async (files: File[]) => {
        // Load into memory using blob URLs
        const newCards: CardImage[] = files.map((file) => {
            const imageUrl = URL.createObjectURL(file);
            return {
                id: crypto.randomUUID(),
                imageUrl,
                thumbnailUrl: undefined,
                thumbnailLoading: true,
                name: file.name,
                bleed: defaultBleed,
                useCustomBleed: false,
                cardBackBleed: defaultCardBackBleed,
                useCustomCardBackBleed: false,
            };
        });

        // Add cards to map and order
        setCardMap((prev) => {
            const newMap = new Map(prev);
            newCards.forEach(card => newMap.set(card.id, card));
            return newMap;
        });

        setCardOrder((prev) => [...prev, ...newCards.map(card => card.id)]);

        // Generate thumbnails
        newCards.forEach(async (card, index) => {
            const file = files[index];

            try {
                const thumbnailUrl = await generateThumbnailAsync(
                    file,
                    800,
                    800,
                    0.85,
                    defaultBleed,
                    cardWidth,
                    cardHeight
                );

                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const existingCard = newMap.get(card.id);
                    if (existingCard) {
                        newMap.set(card.id, {
                            ...existingCard,
                            thumbnailUrl,
                            thumbnailLoading: false
                        });
                    }
                    return newMap;
                });
            } catch (error) {
                console.warn('Failed to create thumbnail for', card.name, ':', error);
                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const existingCard = newMap.get(card.id);
                    if (existingCard) {
                        newMap.set(card.id, {
                            ...existingCard,
                            thumbnailLoading: false
                        });
                    }
                    return newMap;
                });
            }
        });
    }, [defaultBleed, defaultCardBackBleed, cardWidth, cardHeight, setCardMap, setCardOrder]);

    // Opens file selection - uses Tauri dialog or falls back to file input
    const openFileSelection = useCallback(async (fileInputRef: RefObject<HTMLInputElement | null>) => {
        if (isTauri) {
            const { open } = await import("@tauri-apps/plugin-dialog");
            const selected = await open({
                multiple: true,
                filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }],
            });

            if (selected) {
                const paths = Array.isArray(selected) ? selected : [selected];
                if (paths.length > 0) {
                    handleFilePathsSelected(paths);
                }
            }
        } else {
            fileInputRef.current?.click();
        }
    }, [handleFilePathsSelected]);

    return { handleFilesSelected, openFileSelection };
}
