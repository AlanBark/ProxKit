import { createContext, useContext, useState, useRef, useEffect, type ReactNode } from "react";
import { PDFManager } from "../utils/pdf/PDFManager";
import type { CardImage } from "../types/card";
import { CARD_DIMENSIONS } from "../types/card";
import type { Selection } from "@heroui/react";

export const PAGE_SIZE_OPTIONS = [
    { key: "A4", label: "A4", width: 210, height: 297 },
    { key: "Letter", label: "Letter", width: 215.9, height: 279.4 }
] as const;

interface AppState {
    // Card state
    cards: CardImage[];
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
    handleRemoveCard: (cardId: string) => void;
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
    const [cards, setCards] = useState<CardImage[]>([]);
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
            if (!pdfManagerRef.current || cards.length === 0) {
                setPdfUrl(null);
                setIsGenerating(false);
                return;
            }

            setIsGenerating(true);
            setGenerationProgress(0);
            try {
                const url = await pdfManagerRef.current.generatePDF(cards);
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
    }, [cards]);

    const handleFilesSelected = async (files: File[]) => {
        const newCards: CardImage[] = files.map((file) => {
            const imageUrl = URL.createObjectURL(file);
            return {
                id: crypto.randomUUID(),
                imageUrl,
                name: file.name,
                bleed: defaultBleed,
            };
        });

        setCards((prev) => [...prev, ...newCards]);
    };

    const handleRemoveCard = (cardId: string) => {
        setCards((prev) => {
            const card = prev.find((c) => c.id === cardId);
            if (card) {
                URL.revokeObjectURL(card.imageUrl);
            }
            return prev.filter((c) => c.id !== cardId);
        });
    };

    const handleRemoveAllCards = () => {
        setCards([])
    }

    const handleUpdateBleed = (cardId: string, bleed: number) => {
        setCards((prev) =>
            prev.map((card) => (card.id === cardId ? { ...card, bleed } : card))
        );
    };

    const handleDuplicateCard = (cardToDuplicate: CardImage) => {
        const newCard: CardImage = {
            id: crypto.randomUUID(),
            imageUrl: cardToDuplicate.imageUrl,
            name: cardToDuplicate.name,
            bleed: cardToDuplicate.bleed,
        };
        setCards((prev) => [...prev, newCard]);
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
        cards,
        pdfUrl,
        isGenerating,
        generationProgress,
        pageSize,
        cardWidth,
        cardHeight,
        defaultBleed,
        handleFilesSelected,
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
