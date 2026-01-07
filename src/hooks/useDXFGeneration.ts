import { useState, useEffect } from "react";
import type { CardImage } from "../types/card";
import { usePrintAndCutStore, PAGE_SIZE_OPTIONS } from "../stores/printAndCutStore";
import { generateDxfUrl } from "../utils/pdf/dxfGenerator";

/**
 * Hook for managing DXF cut file generation from card data.
 */
export function useDXFGeneration() {
    const [dxfUrl, setDxfUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get card and settings from store
    const cardMap = usePrintAndCutStore((state) => state.cardMap);
    const cardOrder = usePrintAndCutStore((state) => state.cardOrder);
    const pageSize = usePrintAndCutStore((state) => state.pageSize);
    const cardWidth = usePrintAndCutStore((state) => state.cardWidth);
    const cardHeight = usePrintAndCutStore((state) => state.cardHeight);
    const outputBleed = usePrintAndCutStore((state) => state.outputBleed);
    const skipSlots = usePrintAndCutStore((state) => state.skipSlots);

    // Clear DXF URL when cards are removed
    useEffect(() => {
        if (cardOrder.length === 0) {
            if (dxfUrl) {
                URL.revokeObjectURL(dxfUrl);
            }
            setDxfUrl(null);
            setError(null);
        }
    }, [cardOrder.length, dxfUrl]);

    // Auto-generate DXF when card data or settings change
    useEffect(() => {
        // Don't generate if there are no cards
        if (cardOrder.length === 0) {
            return;
        }

        const generateDxf = async () => {
            setIsGenerating(true);
            setError(null);

            try {
                // Get page settings
                const selectedKey = Array.from(pageSize)[0] as string;
                const selectedPage = PAGE_SIZE_OPTIONS.find(p => p.key === selectedKey);
                const pageSettings = selectedPage
                    ? { width: selectedPage.width, height: selectedPage.height, margin: 10 }
                    : { width: 210, height: 297, margin: 10 };

                // Build cards array with skip slots
                const cardsArray = cardOrder.map(id => cardMap.get(id)).filter((card): card is CardImage => card !== undefined);

                // Transform cards array to include nulls for skipped slots
                const skipSlotsArray = Array.from(skipSlots).sort((a, b) => a - b);
                const CARDS_PER_PAGE = 8;
                const availableSlotsPerPage = CARDS_PER_PAGE - skipSlotsArray.length;
                const totalPages = Math.ceil(cardsArray.length / availableSlotsPerPage);

                const cardsWithSkippedSlots: (CardImage | null)[] = [];
                let cardIdx = 0;

                for (let page = 0; page < totalPages; page++) {
                    for (let slot = 0; slot < CARDS_PER_PAGE; slot++) {
                        if (skipSlotsArray.includes(slot)) {
                            cardsWithSkippedSlots.push(null);
                        } else if (cardIdx < cardsArray.length) {
                            cardsWithSkippedSlots.push(cardsArray[cardIdx]);
                            cardIdx++;
                        }
                    }
                }

                // Revoke old URL if it exists
                if (dxfUrl) {
                    URL.revokeObjectURL(dxfUrl);
                }

                const newDxfUrl = generateDxfUrl(
                    cardsWithSkippedSlots,
                    pageSettings,
                    cardWidth,
                    cardHeight,
                    outputBleed,
                    []
                );

                setDxfUrl(newDxfUrl);
            } catch (err) {
                console.error("Failed to generate DXF:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
                setDxfUrl(null);
            } finally {
                setIsGenerating(false);
            }
        };

        generateDxf();

        // Cleanup revoke URL on unmount
        return () => {
            if (dxfUrl) {
                URL.revokeObjectURL(dxfUrl);
            }
        };
    }, [cardMap, cardOrder, pageSize, cardWidth, cardHeight, outputBleed, skipSlots]);

    const handleDownloadDXF = () => {
        if (!dxfUrl) return;

        const link = document.createElement("a");
        link.href = dxfUrl;
        link.download = `cut-file-${new Date().getTime()}.dxf`;
        link.click();
    };

    return {
        dxfUrl,
        isGenerating,
        error,
        handleDownloadDXF
    };
}
