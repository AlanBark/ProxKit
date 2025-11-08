import { createContext, useContext, useState, useRef, useEffect, type ReactNode } from "react";
import { PDFManager } from "../utils/pdf/PDFManager";
import type { CardImage } from "../types/card";
import { CARD_DIMENSIONS } from "../types/card";
import type { Selection } from "@heroui/react";
import { createThumbnail } from "../utils/imageUtils";

export const PAGE_SIZE_OPTIONS = [
    { key: "A4", label: "A4", width: 210, height: 297 },
    { key: "Letter", label: "Letter", width: 215.9, height: 279.4 }
] as const;

interface AppState {
    // Card state
    cardMap: Map<string, CardImage>;
    cardOrder: string[];
    pdfUrl: string | null;
    isGenerating: boolean;
    generationProgress: number; // 0-100 percentage

    // Settings
    pageSize: Selection;
    cardWidth: number;
    cardHeight: number;
    defaultBleed: number;

    // Actions
    handleFilesSelected: (files: File[]) => void;
    handleRemoveCard: (cardIndex: number) => void;
    handleRemoveAllCards: () => void;
    handleUpdateBleed: (cardId: string, bleed: number) => void;
    handleDuplicateCard: (card: CardImage) => void;
    handleDownloadPDF: () => void;
    handlePrintPDF: () => void;
    setPageSize: (size: Selection) => void;
    setCardWidth: (width: number) => void;
    setCardHeight: (height: number) => void;
    setDefaultBleed: (bleed: number) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
    const [cardMap, setCardMap] = useState<Map<string, CardImage>>(new Map());
    const [cardOrder, setCardOrder] = useState<string[]>([]);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState<number>(0);
    const pdfManagerRef = useRef<PDFManager | null>(null);

    // Settings
    const [defaultBleed, setDefaultBleed] = useState<number>(CARD_DIMENSIONS.standardBleed);
    const [cardWidth, setCardWidth] = useState<number>(CARD_DIMENSIONS.width);
    const [cardHeight, setCardHeight] = useState<number>(CARD_DIMENSIONS.height);
    const [pageSize, setPageSize] = useState<Selection>(new Set(["A4"]));

    // Initialize PDF manager
    useEffect(() => {
        const selectedKey = Array.from(pageSize)[0] as string;
        const selectedPage = PAGE_SIZE_OPTIONS.find(p => p.key === selectedKey);
        const pageSettings = selectedPage
            ? { width: selectedPage.width, height: selectedPage.height, margin: 10 }
            : { width: 210, height: 297, margin: 10 };

        pdfManagerRef.current = new PDFManager(pageSettings, cardWidth, cardHeight);

        // Set up progress callback
        pdfManagerRef.current.onProgress = (_current, _total, percentage) => {
            setGenerationProgress(percentage);
        };

        return () => {
            pdfManagerRef.current?.dispose();
        };
    }, [pageSize, cardWidth, cardHeight]);

    // Auto-generate PDF whenever cards change
    useEffect(() => {
        const generatePDF = async () => {
            if (!pdfManagerRef.current || cardOrder.length === 0) {
                setPdfUrl(null);
                setIsGenerating(false);
                return;
            }

            setIsGenerating(true);
            setGenerationProgress(0);
            try {
                // Convert map + order back to array for PDF generation
                const cardsArray = cardOrder.map(id => cardMap.get(id)).filter((card): card is CardImage => card !== undefined);
                const url = await pdfManagerRef.current.generatePDF(cardsArray);
                setPdfUrl(url);
            } catch (error) {
                console.error("Failed to generate PDF:", error);
                setPdfUrl(null);
            } finally {
                setIsGenerating(false);
                setGenerationProgress(0);
            }
        };

        generatePDF();
    }, [cardMap, cardOrder]);

    const handleAddCards = async (files: File[]) => {
        const newCards: CardImage[] = await Promise.all(
            files.map(async (file) => {
                const imageUrl = URL.createObjectURL(file);
                let thumbnailUrl: string | undefined;

                try {
                    // Create a lower-res thumbnail for UI display with bleed cropped out
                    thumbnailUrl = await createThumbnail(file, 800, 800, 0.85, defaultBleed, cardWidth, cardHeight);
                } catch (error) {
                    console.warn('Failed to create thumbnail, using original:', error);
                    // Fall back to original if thumbnail creation fails
                    thumbnailUrl = undefined;
                }

                return {
                    id: crypto.randomUUID(),
                    imageUrl,
                    thumbnailUrl,
                    name: file.name,
                    bleed: defaultBleed,
                };
            })
        );

        setCardMap((prev) => {
            const newMap = new Map(prev);
            newCards.forEach(card => newMap.set(card.id, card));
            return newMap;
        });

        setCardOrder((prev) => [...prev, ...newCards.map(card => card.id)]);
    };

    const handleRemoveCard = (cardIndex: number) => {

        let cardId = cardOrder[cardIndex];
        let cardIdInstances = cardOrder.filter((card) => { card === cardId })

        if (cardIdInstances.length === 1) {
            // Remove the card itself if this is the last instance of it being removed
            let card = cardMap.get(cardId);
            if (card) {
                URL.revokeObjectURL(card.imageUrl);
                if (card.thumbnailUrl) {
                    URL.revokeObjectURL(card.thumbnailUrl);
                }
            }

            setCardMap((prevCardMap) => {
                const newCardMap = new Map(prevCardMap);
                newCardMap.delete(cardId);
                return newCardMap;
            });
        }
        // Then always remove the order from the order list
        setCardOrder((prevCardMap) => {
            const newCardOrder = [...prevCardMap];
            newCardOrder.splice(cardIndex, 1);
            return newCardOrder;
        });
    };

    const handleRemoveAllCards = () => {
        for (let card of cardMap.values()) {
            URL.revokeObjectURL(card.imageUrl);
            if (card.thumbnailUrl) {
                URL.revokeObjectURL(card.thumbnailUrl);
            }
        }
        setCardMap(new Map());
        setCardOrder([]);
    }

    const handleUpdateBleed = async (cardId: string, bleed: number) => {
        const card = cardMap.get(cardId);
        if (!card) return;

        try {
            // Fetch the original image blob from the blob URL
            const response = await fetch(card.imageUrl);
            const blob = await response.blob();
            const file = new File([blob], card.name || 'image.jpg', { type: blob.type });

            // Regenerate thumbnail with new bleed value
            const newThumbnailUrl = await createThumbnail(file, 800, 800, 0.85, bleed, cardWidth, cardHeight);

            // Clean up old thumbnail URL if it exists
            if (card.thumbnailUrl) {
                URL.revokeObjectURL(card.thumbnailUrl);
            }

            // Update card with new bleed and thumbnail
            setCardMap((prev) => {
                const newMap = new Map(prev);
                newMap.set(cardId, { ...card, bleed, thumbnailUrl: newThumbnailUrl });
                return newMap;
            });
        } catch (error) {
            console.error('Failed to regenerate thumbnail with new bleed:', error);
            // Fall back to just updating the bleed value
            setCardMap((prev) => {
                const newMap = new Map(prev);
                newMap.set(cardId, { ...card, bleed });
                return newMap;
            });
        }
    };

    const handleDuplicateCard = (cardToDuplicate: CardImage) => {
        const newCard: CardImage = {
            id: crypto.randomUUID(),
            imageUrl: cardToDuplicate.imageUrl,
            name: cardToDuplicate.name,
            bleed: cardToDuplicate.bleed,
        };

        setCardMap((prev) => {
            const newMap = new Map(prev);
            newMap.set(newCard.id, newCard);
            return newMap;
        });

        setCardOrder((prev) => [...prev, newCard.id]);
    };

    const handleDownloadPDF = () => {
        if (!pdfUrl) return;

        const link = document.createElement("a");
        link.href = pdfUrl;
        link.download = `card-sheet-${new Date().getTime()}.pdf`;
        link.click();
    };

    const handlePrintPDF = () => {
        if (!pdfUrl) return;

        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = pdfUrl;
        document.body.appendChild(iframe);

        iframe.onload = () => {
            iframe.contentWindow?.print();
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 100);
        };
    };

    const value: AppState = {
        cardMap,
        cardOrder,
        pdfUrl,
        isGenerating,
        generationProgress,
        pageSize,
        cardWidth,
        cardHeight,
        defaultBleed,
        handleFilesSelected: handleAddCards,
        handleRemoveCard,
        handleRemoveAllCards,
        handleUpdateBleed,
        handleDuplicateCard,
        handleDownloadPDF,
        handlePrintPDF,
        setPageSize,
        setCardWidth,
        setCardHeight,
        setDefaultBleed,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error("useApp must be used within an AppProvider");
    }
    return context;
}
