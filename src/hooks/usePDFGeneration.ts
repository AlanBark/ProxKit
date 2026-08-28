import { useState, useRef, useEffect } from "react";
import { PDFManager } from "../utils/pdf/PDFManager";
import type { CardImage } from "../types/card";
import { usePrintAndCutStore, PAGE_SIZE_OPTIONS } from "../stores/printAndCutStore";
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { toBackendPath } from "../utils/imageSource";

/**
 * Hook for managing PDF generation from card data.
 *
 * Features:
 * - Generates PDF sheets with card layout
 * - Tracks generation progress
 * - Detects state changes to avoid redundant generation
 * - Auto-clears URLs when cards are removed
 */
export function usePDFGeneration() {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const pdfManagerRef = useRef<PDFManager | null>(null);

    // Track the state when PDF was last generated
    const lastGeneratedStateRef = useRef<string | null>(null);

    // Get card and settings from store
    const cardMap = usePrintAndCutStore((state) => state.cardMap);
    const cardOrder = usePrintAndCutStore((state) => state.cardOrder);
    const pageSize = usePrintAndCutStore((state) => state.pageSize);
    const cardWidth = usePrintAndCutStore((state) => state.cardWidth);
    const cardHeight = usePrintAndCutStore((state) => state.cardHeight);
    const outputBleed = usePrintAndCutStore((state) => state.outputBleed);
    const enableCardBacks = usePrintAndCutStore((state) => state.enableCardBacks);
    const defaultCardBack = usePrintAndCutStore((state) => state.defaultCardBack);
    const skipSlots = usePrintAndCutStore((state) => state.skipSlots);

    // Initialize PDF manager when settings change
    useEffect(() => {
        const selectedKey = Array.from(pageSize)[0] as string;
        const selectedPage = PAGE_SIZE_OPTIONS.find(p => p.key === selectedKey);
        const pageSettings = selectedPage
            ? { width: selectedPage.width, height: selectedPage.height, margin: 10 }
            : { width: 210, height: 297, margin: 10 };

        pdfManagerRef.current = new PDFManager(
            pageSettings,
            cardWidth,
            cardHeight,
            outputBleed
        );

        return () => {
            pdfManagerRef.current?.dispose();
        };
    }, [pageSize, cardWidth, cardHeight, outputBleed]);

    // Clear PDF URLs when cards are removed
    useEffect(() => {
        if (cardOrder.length === 0) {
            setPdfUrl(null);
            setIsGenerating(false);
            setError(null);
            lastGeneratedStateRef.current = null;
        }
    }, [cardOrder.length]);

    const handleGeneratePDF = async () => {
        if (!pdfManagerRef.current || cardOrder.length === 0 || isGenerating) {
            return;
        }

        setIsGenerating(true);
        setGenerationProgress(0);
        setError(null);

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

        try {
            if (window.__TAURI_INTERNALS__) {
                // Tauri: User Dialogue for file selection
                // Then dispatch to rust for gen and file save

                // Get save path
                const path = await save({
                    title: 'Save Cards',
                    defaultPath: `cards-${new Date().getTime()}.pdf`,
                    filters: [
                        {
                            name: 'PDF',
                            extensions: ['pdf'],
                        },
                    ],
                });

                // path is null if user cancels dialogue
                if (path !== null) {
                    // Get page settings
                    const selectedKey = Array.from(pageSize)[0] as string;
                    const selectedPage = PAGE_SIZE_OPTIONS.find(p => p.key === selectedKey);
                    const pageSettings = selectedPage
                        ? { width: selectedPage.width, height: selectedPage.height, margin: 10 }
                        : { width: 210, height: 297, margin: 10 };

                    // Map cards to minimal representation, preserving nulls for gaps.
                    // toBackendPath rejects in-memory sources here, at the boundary,
                    // rather than letting Rust fail on a blob: URL further down.
                    const minimalCards = cardsWithSkippedSlots.map(card => {
                        if (card === null) return null;
                        if (!card.image) {
                            throw new Error(`"${card.name ?? card.id}" has no image loaded yet.`);
                        }
                        return {
                            id: card.id,
                            imagePath: toBackendPath(card.image, card.name),
                            name: card.name,
                            bleed: card.bleed,
                            useCustomBleed: card.useCustomBleed,
                            cardBackPath: card.cardBack
                                ? toBackendPath(card.cardBack, `${card.name ?? card.id} (back)`)
                                : null,
                            cardBackBleed: card.cardBackBleed,
                            useCustomCardBackBleed: card.useCustomCardBackBleed,
                        };
                    });

                    // Call Rust backend with proper types
                    const result = await invoke<string>('generate_cardlist', {
                        request: {
                            cards: minimalCards,
                            outputPath: path,
                            pageWidth: pageSettings.width,
                            pageHeight: pageSettings.height,
                            cardWidth: cardWidth,
                            cardHeight: cardHeight,
                            outputBleed: outputBleed,
                            enableCardBacks: enableCardBacks,
                            defaultCardBackPath: defaultCardBack
                                ? toBackendPath(defaultCardBack, 'The default card back')
                                : null,
                        }
                    });

                    console.log('PDF generated:', result);
                }

            } else {
                // Web: Generate and auto-download PDF
                // The audo download happens within the pdfManager

                // Set progress callback
                pdfManagerRef.current.onProgress = (_current: number, _total: number, percentage: number) => {
                    setGenerationProgress(percentage);
                };

                const pdfUrlResult = await pdfManagerRef.current.generatePDF(
                    cardsWithSkippedSlots,
                    enableCardBacks,
                    defaultCardBack,
                    Array.from(skipSlots)
                );

                setPdfUrl(pdfUrlResult);
            }
        } catch (err) {
            console.error("Failed to generate PDF:", err);
            // Tauri commands reject with a plain string, not an Error
            setError(
                typeof err === "string" ? err
                    : err instanceof Error ? err.message
                    : "Unknown error"
            );
            setPdfUrl(null);
        } finally {
            setIsGenerating(false);
            setGenerationProgress(0);
        }
    };

    const handleDownloadPDF = () => {
        if (!pdfUrl) return;

        const link = document.createElement("a");
        link.href = pdfUrl;
        link.download = `card-sheet-${new Date().getTime()}.pdf`;
        link.click();
    };

    return {
        pdfUrl,
        isGenerating,
        generationProgress,
        error,
        handleGeneratePDF,
        handleDownloadPDF,
    };
}
