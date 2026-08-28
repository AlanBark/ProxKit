import { useState, useRef, useEffect } from "react";
import { PDFManager } from "../utils/pdf/PDFManager";
import { useProjectSettingsStore, PAGE_SIZE_OPTIONS } from "../stores/projectSettingsStore";
import { useAppSettingsStore } from "../stores/appSettingsStore";
import { useCardStore } from "../stores/cardStore";
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toBackendPath } from "../utils/imageSource";
import { layoutPages, slotsToCards } from "../utils/pdf/cardLayoutUtils";
import { basename, dirname, joinPath } from "../utils/paths";

/** Shape of the Rust generate_cardlist response. */
interface GenerationOutcome {
    outputPath: string;
    skipped: { filePath: string; reason: string }[];
}

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
    /** Cards the backend could not render. The PDF still exists without them. */
    const [skipped, setSkipped] = useState<string[]>([]);
    /** Where the last PDF was written, so the user gets confirmation. */
    const [savedPath, setSavedPath] = useState<string | null>(null);
    const pdfManagerRef = useRef<PDFManager | null>(null);

    // Track the state when PDF was last generated
    const lastGeneratedStateRef = useRef<string | null>(null);

    // Get card and settings from store
    const cardMap = useCardStore((state) => state.cardMap);
    const cardOrder = useCardStore((state) => state.cardOrder);
    const pageSize = useProjectSettingsStore((state) => state.pageSize);
    const cardWidth = useProjectSettingsStore((state) => state.cardWidth);
    const cardHeight = useProjectSettingsStore((state) => state.cardHeight);
    const outputBleed = useProjectSettingsStore((state) => state.outputBleed);
    const enableCardBacks = useProjectSettingsStore((state) => state.enableCardBacks);
    const defaultCardBack = useProjectSettingsStore((state) => state.defaultCardBack);
    const lastOutputDir = useAppSettingsStore((state) => state.lastOutputDir);
    const setLastOutputDir = useAppSettingsStore((state) => state.setLastOutputDir);
    const skipSlots = useProjectSettingsStore((state) => state.skipSlots);

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

    // The desktop backend reports image-preparation progress as it goes; without
    // this the window looks frozen for the whole export.
    useEffect(() => {
        if (!window.__TAURI_INTERNALS__) return;

        const unlisten = listen<{ done: number; total: number }>(
            'cardlist-progress',
            (event) => {
                const { done, total } = event.payload;
                if (total > 0) {
                    setGenerationProgress(Math.round((done / total) * 100));
                }
            }
        );

        return () => { unlisten.then((off) => off()); };
    }, []);

    // Clear PDF URLs when cards are removed
    useEffect(() => {
        if (cardOrder.length === 0) {
            setPdfUrl(null);
            setIsGenerating(false);
            setError(null);
            setSkipped([]);
            setSavedPath(null);
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
        setSkipped([]);
        setSavedPath(null);

        const cardsWithSkippedSlots = slotsToCards(layoutPages(cardOrder, cardMap, skipSlots));

        try {
            if (window.__TAURI_INTERNALS__) {
                // Tauri: User Dialogue for file selection
                // Then dispatch to rust for gen and file save

                // Get save path
                const fileName = `cards-${new Date().getTime()}.pdf`;
                const path = await save({
                    title: 'Save Cards',
                    // Reopen wherever the last PDF was written.
                    defaultPath: lastOutputDir ? joinPath(lastOutputDir, fileName) : fileName,
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
                    const result = await invoke<GenerationOutcome>('generate_cardlist', {
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

                    console.log('PDF generated:', result.outputPath);
                    setLastOutputDir(dirname(path));
                    setSkipped(result.skipped.map(item => basename(item.filePath)));
                    setSavedPath(result.outputPath);
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
        skipped,
        savedPath,
        handleGeneratePDF,
        handleDownloadPDF,
    };
}
