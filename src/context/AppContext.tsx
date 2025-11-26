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
    dxfUrl: string | null;
    isGenerating: boolean;
    generationProgress: number; // 0-100 percentage

    // Settings
    pageSize: Selection;
    cardWidth: number;
    cardHeight: number;
    defaultBleed: number;
    outputBleed: number,
    enableCardBacks: boolean;
    defaultCardBackUrl: string | null;
    groupByCardBacks: boolean;

    // Actions
    handleFilesSelected: (files: File[]) => void;
    handleRemoveCard: (cardIndex: number) => void;
    handleRemoveAllCards: () => void;
    handleUpdateBleed: (cardId: string, bleed: number) => void;
    handleDuplicateCard: (card: CardImage) => void;
    handleGeneratePDF: () => Promise<void>;
    handleDownloadPDF: () => void;
    handleDownloadDXF: () => void;
    setPageSize: (size: Selection) => void;
    setCardWidth: (width: number) => void;
    setCardHeight: (height: number) => void;
    setDefaultBleed: (bleed: number) => void;
    setOutputBleed: (bleed: number) => void;
    setEnableCardBacks: (enabled: boolean) => void;
    setDefaultCardBackUrl: (url: string | null) => void;
    setGroupByCardBacks: (group: boolean) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
    const [cardMap, setCardMap] = useState<Map<string, CardImage>>(new Map());
    const [cardOrder, setCardOrder] = useState<string[]>([]);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [dxfUrl, setDxfUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState<number>(0);
    const pdfManagerRef = useRef<PDFManager | null>(null);

    // Settings
    const [defaultBleed, setDefaultBleed] = useState<number>(CARD_DIMENSIONS.standardBleed);
    const [outputBleed, setOutputBleed] = useState<number>(CARD_DIMENSIONS.outputBleed);
    const [cardWidth, setCardWidth] = useState<number>(CARD_DIMENSIONS.width);
    const [cardHeight, setCardHeight] = useState<number>(CARD_DIMENSIONS.height);
    const [pageSize, setPageSize] = useState<Selection>(new Set(["A4"]));
    const [enableCardBacks, setEnableCardBacks] = useState<boolean>(false);
    const [defaultCardBackUrl, setDefaultCardBackUrl] = useState<string | null>(null);
    const [groupByCardBacks, setGroupByCardBacks] = useState<boolean>(false);

    // Initialize PDF manager
    useEffect(() => {
        const selectedKey = Array.from(pageSize)[0] as string;
        const selectedPage = PAGE_SIZE_OPTIONS.find(p => p.key === selectedKey);
        const pageSettings = selectedPage
            ? { width: selectedPage.width, height: selectedPage.height, margin: 10 }
            : { width: 210, height: 297, margin: 10 };

        pdfManagerRef.current = new PDFManager(pageSettings, cardWidth, cardHeight, outputBleed);

        // Set up progress callback
        pdfManagerRef.current.onProgress = (_current, _total, percentage) => {
            setGenerationProgress(percentage);
        };

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
        }
    }, [cardOrder.length]);

    const handleAddCards = async (files: File[]) => {
        // Create cards immediately with loading state, don't wait for thumbnails
        const newCards: CardImage[] = files.map((file) => {
            const imageUrl = URL.createObjectURL(file);
            return {
                id: crypto.randomUUID(),
                imageUrl,
                thumbnailUrl: undefined,
                thumbnailLoading: true,
                name: file.name,
                bleed: defaultBleed,
            };
        });

        // Add cards to state immediately so they appear in UI
        setCardMap((prev) => {
            const newMap = new Map(prev);
            newCards.forEach(card => newMap.set(card.id, card));
            return newMap;
        });

        setCardOrder((prev) => [...prev, ...newCards.map(card => card.id)]);

        // Generate thumbnails asynchronously in the background
        newCards.forEach(async (card, index) => {
            const file = files[index];

            try {
                // Use requestIdleCallback to avoid blocking the main thread
                const generateThumbnail = () => {
                    return createThumbnail(file, 800, 800, 0.85, defaultBleed, cardWidth, cardHeight);
                };

                const thumbnailUrl = await new Promise<string>((resolve, reject) => {
                    if ('requestIdleCallback' in window) {
                        requestIdleCallback(async () => {
                            try {
                                const url = await generateThumbnail();
                                resolve(url);
                            } catch (error) {
                                reject(error);
                            }
                        });
                    } else {
                        // Fallback for browsers without requestIdleCallback
                        setTimeout(async () => {
                            try {
                                const url = await generateThumbnail();
                                resolve(url);
                            } catch (error) {
                                reject(error);
                            }
                        }, 0);
                    }
                });

                // Update card with thumbnail once it's ready
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
                // Mark as not loading even if failed
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

        // Set loading state immediately
        setCardMap((prev) => {
            const newMap = new Map(prev);
            newMap.set(cardId, { ...card, bleed, thumbnailLoading: true });
            return newMap;
        });

        try {
            // Fetch the original image blob from the blob URL
            const response = await fetch(card.imageUrl);
            const blob = await response.blob();
            const file = new File([blob], card.name || 'image.jpg', { type: blob.type });

            // Regenerate thumbnail with new bleed value asynchronously
            const generateThumbnail = () => {
                return createThumbnail(file, 800, 800, 0.85, bleed, cardWidth, cardHeight);
            };

            const newThumbnailUrl = await new Promise<string>((resolve, reject) => {
                if ('requestIdleCallback' in window) {
                    requestIdleCallback(async () => {
                        try {
                            const url = await generateThumbnail();
                            resolve(url);
                        } catch (error) {
                            reject(error);
                        }
                    });
                } else {
                    setTimeout(async () => {
                        try {
                            const url = await generateThumbnail();
                            resolve(url);
                        } catch (error) {
                            reject(error);
                        }
                    }, 0);
                }
            });

            // Clean up old thumbnail URL if it exists
            if (card.thumbnailUrl) {
                URL.revokeObjectURL(card.thumbnailUrl);
            }

            // Update card with new bleed and thumbnail
            setCardMap((prev) => {
                const newMap = new Map(prev);
                const currentCard = newMap.get(cardId);
                if (currentCard) {
                    newMap.set(cardId, {
                        ...currentCard,
                        thumbnailUrl: newThumbnailUrl,
                        thumbnailLoading: false
                    });
                }
                return newMap;
            });
        } catch (error) {
            console.error('Failed to regenerate thumbnail with new bleed:', error);
            // Fall back to just updating the bleed value and clearing loading state
            setCardMap((prev) => {
                const newMap = new Map(prev);
                const currentCard = newMap.get(cardId);
                if (currentCard) {
                    newMap.set(cardId, { ...currentCard, thumbnailLoading: false });
                }
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
            thumbnailUrl: cardToDuplicate.thumbnailUrl
        };

        setCardMap((prev) => {
            const newMap = new Map(prev);
            newMap.set(newCard.id, newCard);
            return newMap;
        });

        setCardOrder((prev) => [...prev, newCard.id]);
    };

    const handleGeneratePDF = async () => {
        if (!pdfManagerRef.current || cardOrder.length === 0 || isGenerating) {
            return;
        }

        setIsGenerating(true);
        setGenerationProgress(0);
        try {
            // Convert map + order back to array for PDF generation
            const cardsArray = cardOrder.map(id => cardMap.get(id)).filter((card): card is CardImage => card !== undefined);
            const pdfUrlResult = await pdfManagerRef.current.generatePDF(cardsArray);
            const dxfUrlResult = pdfManagerRef.current.getCachedDxfUrl();
            setPdfUrl(pdfUrlResult);
            setDxfUrl(dxfUrlResult);

            // Auto-download the PDF after generation (PDFManager handles multiple files)
            // Note: Multiple PDFs are auto-downloaded by PDFManager.generatePDF
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

    const value: AppState = {
        cardMap,
        cardOrder,
        pdfUrl,
        dxfUrl,
        isGenerating,
        generationProgress,
        pageSize,
        cardWidth,
        cardHeight,
        defaultBleed,
        outputBleed,
        enableCardBacks,
        defaultCardBackUrl,
        groupByCardBacks,
        handleFilesSelected: handleAddCards,
        handleRemoveCard,
        handleRemoveAllCards,
        handleUpdateBleed,
        handleDuplicateCard,
        handleGeneratePDF,
        handleDownloadPDF,
        handleDownloadDXF,
        setPageSize,
        setCardWidth,
        setCardHeight,
        setDefaultBleed,
        setEnableCardBacks,
        setDefaultCardBackUrl,
        setGroupByCardBacks,
        setOutputBleed,
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
