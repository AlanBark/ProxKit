import { useState, useRef, useEffect } from "react";
import { PDFManager } from "../utils/pdf/PDFManager";
import type { CardImage } from "../types/card";
import { usePrintAndCutStore, PAGE_SIZE_OPTIONS } from "../stores/printAndCutStore";
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

/**
 * Hook for managing PDF and DXF generation from card data.
 *
 * Features:
 * - Generates PDF sheets with card layout
 * - Generates DXF cut files for cutting machines
 * - Tracks generation progress
 * - Detects state changes to avoid redundant generation
 * - Auto-clears URLs when cards are removed
 */
export function usePDFGeneration() {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [dxfUrl, setDxfUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState<number>(0);
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
    const defaultCardBackUrl = usePrintAndCutStore((state) => state.defaultCardBackUrl);
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

    // Clear PDF/DXF URLs when cards are removed
    useEffect(() => {
        if (cardOrder.length === 0) {
            setPdfUrl(null);
            setDxfUrl(null);
            setIsGenerating(false);
            lastGeneratedStateRef.current = null;
        }
    }, [cardOrder.length]);

    const handleGeneratePDF = async () => {
        if (!pdfManagerRef.current || cardOrder.length === 0 || isGenerating) {
            return;
        }

        setIsGenerating(true);
        setGenerationProgress(0);
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
                if (path !== null)
                {
                    const result = await invoke<string>('generate_pdf', {
                        filePath: path
                    });
                    console.log('PDF generated:', result);
                }

            } else {
                // Web: Generate and auto-download PDF
                // The audo download happens within the pdfManager
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

                // Set progress callback
                pdfManagerRef.current.onProgress = (_current: number, _total: number, percentage: number) => {
                    setGenerationProgress(percentage);
                };

                const pdfUrlResult = await pdfManagerRef.current.generatePDF(
                    cardsWithSkippedSlots,
                    enableCardBacks,
                    defaultCardBackUrl,
                    Array.from(skipSlots)
                );

                const dxfUrlResult = pdfManagerRef.current.getCachedUrl();
                setPdfUrl(pdfUrlResult);
                setDxfUrl(dxfUrlResult);
            }
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            setPdfUrl(null);
            setDxfUrl(null);
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

    const handleDownloadDXF = () => {
        if (!dxfUrl) return;

        const link = document.createElement("a");
        link.href = dxfUrl;
        link.download = `cut-file-${new Date().getTime()}.dxf`;
        link.click();
    };

    return {
        pdfUrl,
        dxfUrl,
        isGenerating,
        generationProgress,
        handleGeneratePDF,
        handleDownloadPDF,
        handleDownloadDXF,
    };
}
