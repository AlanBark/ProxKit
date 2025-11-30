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
    defaultCardBackBleed: number;
    outputBleed: number,
    enableCardBacks: boolean;
    defaultCardBackUrl: string | null;
    defaultCardBackThumbnailUrl: string | null;
    groupByCardBacks: boolean;
    showAllCardBacks: boolean;

    // Actions
    handleFilesSelected: (files: File[]) => void;
    handleRemoveCard: (cardIndex: number) => void;
    handleRemoveAllCards: () => void;
    handleUpdateBleed: (cardId: string, bleed: number) => void;
    handleUpdateCardBackBleed: (cardId: string, bleed: number) => void;
    handleDuplicateCard: (card: CardImage, count: number, insertAtIndex?: number) => void;
    handleUpdateCardBack: (cardId: string, file: File | null) => Promise<void>;
    handleGeneratePDF: () => Promise<void>;
    handleDownloadPDF: () => void;
    handleDownloadDXF: () => void;
    setPageSize: (size: Selection) => void;
    setCardWidth: (width: number) => void;
    setCardHeight: (height: number) => void;
    setDefaultBleed: (bleed: number) => void;
    setDefaultCardBackBleed: (bleed: number) => void;
    setOutputBleed: (bleed: number) => void;
    setEnableCardBacks: (enabled: boolean) => void;
    handleUpdateDefaultCardBack: (file: File | null) => Promise<void>;
    setGroupByCardBacks: (group: boolean) => void;
    setShowAllCardBacks: (show: boolean) => void;
    setCardMap: (map: Map<string, CardImage> | ((prev: Map<string, CardImage>) => Map<string, CardImage>)) => void;
    setCardOrder: (order: string[] | ((prev: string[]) => string[])) => void;
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
    const [defaultCardBackBleed, setDefaultCardBackBleed] = useState<number>(CARD_DIMENSIONS.standardBleed);
    const [outputBleed, setOutputBleed] = useState<number>(CARD_DIMENSIONS.outputBleed);
    const [cardWidth, setCardWidth] = useState<number>(CARD_DIMENSIONS.width);
    const [cardHeight, setCardHeight] = useState<number>(CARD_DIMENSIONS.height);
    const [pageSize, setPageSize] = useState<Selection>(new Set(["A4"]));
    const [enableCardBacks, setEnableCardBacks] = useState<boolean>(false);
    const [defaultCardBackUrl, setDefaultCardBackUrl] = useState<string | null>(null);
    const [defaultCardBackThumbnailUrl, setDefaultCardBackThumbnailUrl] = useState<string | null>(null);
    const [groupByCardBacks, setGroupByCardBacks] = useState<boolean>(false);
    const [showAllCardBacks, setShowAllCardBacks] = useState<boolean>(false);

    // Track previous bleed values to detect changes
    const prevDefaultBleedRef = useRef<number>(defaultBleed);
    const prevDefaultCardBackBleedRef = useRef<number>(defaultCardBackBleed);

    // Store the original default card back file for thumbnail regeneration
    const defaultCardBackFileRef = useRef<File | null>(null);

    // Track the state when PDF was last generated
    const lastGeneratedStateRef = useRef<string | null>(null);

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
            lastGeneratedStateRef.current = null;
        }
    }, [cardOrder.length]);

    // Regenerate front thumbnails when defaultBleed changes
    useEffect(() => {
        // Skip on initial mount (when there are no cards yet)
        if (cardOrder.length === 0) return;

        // Get the previous bleed value
        const prevBleed = prevDefaultBleedRef.current;

        // If the bleed hasn't actually changed, skip
        if (prevBleed === defaultBleed) return;

        // Find all cards that are NOT using custom bleed
        const cardsToUpdate = cardOrder
            .map(id => cardMap.get(id))
            .filter((card): card is CardImage => card !== undefined && !card.useCustomBleed);

        // Update the ref for next time
        prevDefaultBleedRef.current = defaultBleed;

        // Regenerate thumbnails for these cards
        cardsToUpdate.forEach(async (card) => {
            try {
                // Set loading state and update bleed value to new default
                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const currentCard = newMap.get(card.id);
                    if (currentCard && !currentCard.useCustomBleed) {
                        newMap.set(card.id, { ...currentCard, bleed: defaultBleed, thumbnailLoading: true });
                    }
                    return newMap;
                });

                // Fetch the original image
                const response = await fetch(card.imageUrl);
                const blob = await response.blob();
                const file = new File([blob], card.name || 'image.jpg', { type: blob.type });

                // Generate thumbnail
                const generateThumbnail = () => {
                    return createThumbnail(file, 800, 800, 0.85, defaultBleed, cardWidth, cardHeight);
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

                // Clean up old thumbnail
                if (card.thumbnailUrl) {
                    URL.revokeObjectURL(card.thumbnailUrl);
                }

                // Update with new thumbnail (only if still not using custom bleed)
                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const currentCard = newMap.get(card.id);
                    if (currentCard && !currentCard.useCustomBleed) {
                        newMap.set(card.id, {
                            ...currentCard,
                            thumbnailUrl: newThumbnailUrl,
                            thumbnailLoading: false
                        });
                    }
                    return newMap;
                });
            } catch (error) {
                console.error('Failed to regenerate thumbnail:', error);
                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const currentCard = newMap.get(card.id);
                    if (currentCard) {
                        newMap.set(card.id, { ...currentCard, thumbnailLoading: false });
                    }
                    return newMap;
                });
            }
        });
    }, [defaultBleed, cardWidth, cardHeight]);

    // Regenerate back thumbnails when defaultCardBackBleed changes
    useEffect(() => {
        // Skip on initial mount (when there are no cards yet)
        if (cardOrder.length === 0) return;

        // Get the previous bleed value
        const prevCardBackBleed = prevDefaultCardBackBleedRef.current;

        // If the bleed hasn't actually changed, skip
        if (prevCardBackBleed === defaultCardBackBleed) return;

        // Find all cards that are NOT using custom back bleed AND have a card back
        const cardsToUpdate = cardOrder
            .map(id => cardMap.get(id))
            .filter((card): card is CardImage =>
                card !== undefined &&
                !card.useCustomCardBackBleed &&
                card.cardBackUrl !== undefined
            );

        // Update the ref for next time
        prevDefaultCardBackBleedRef.current = defaultCardBackBleed;

        // Regenerate back thumbnails for these cards
        cardsToUpdate.forEach(async (card) => {
            if (!card.cardBackUrl) return;

            try {
                // Set loading state and update back bleed value to new default
                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const currentCard = newMap.get(card.id);
                    if (currentCard && !currentCard.useCustomCardBackBleed) {
                        newMap.set(card.id, { ...currentCard, cardBackBleed: defaultCardBackBleed, cardBackThumbnailLoading: true });
                    }
                    return newMap;
                });

                // Fetch the original card back image
                const response = await fetch(card.cardBackUrl);
                const blob = await response.blob();
                const file = new File([blob], `${card.name || 'card'}-back.jpg`, { type: blob.type });

                // Generate thumbnail
                const generateThumbnail = () => {
                    return createThumbnail(file, 800, 800, 0.85, defaultCardBackBleed, cardWidth, cardHeight);
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

                // Clean up old thumbnail
                if (card.cardBackThumbnailUrl) {
                    URL.revokeObjectURL(card.cardBackThumbnailUrl);
                }

                // Update with new thumbnail (only if still not using custom back bleed)
                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const currentCard = newMap.get(card.id);
                    if (currentCard && !currentCard.useCustomCardBackBleed) {
                        newMap.set(card.id, {
                            ...currentCard,
                            cardBackThumbnailUrl: newThumbnailUrl,
                            cardBackThumbnailLoading: false
                        });
                    }
                    return newMap;
                });
            } catch (error) {
                console.error('Failed to regenerate card back thumbnail:', error);
                setCardMap((prev) => {
                    const newMap = new Map(prev);
                    const currentCard = newMap.get(card.id);
                    if (currentCard) {
                        newMap.set(card.id, { ...currentCard, cardBackThumbnailLoading: false });
                    }
                    return newMap;
                });
            }
        });
    }, [defaultCardBackBleed, cardWidth, cardHeight]);

    // Regenerate default card back thumbnail when defaultCardBackBleed changes
    useEffect(() => {
        // Skip if there's no default card back file
        if (!defaultCardBackFileRef.current || !defaultCardBackUrl) return;

        const regenerateDefaultCardBackThumbnail = async () => {
            try {
                const file = defaultCardBackFileRef.current!;

                // Generate thumbnail with new bleed
                const generateThumbnail = () => {
                    return createThumbnail(file, 800, 800, 0.85, defaultCardBackBleed, cardWidth, cardHeight);
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

                // Clean up old thumbnail
                if (defaultCardBackThumbnailUrl) {
                    URL.revokeObjectURL(defaultCardBackThumbnailUrl);
                }

                // Update with new thumbnail
                setDefaultCardBackThumbnailUrl(newThumbnailUrl);
            } catch (error) {
                console.error('Failed to regenerate default card back thumbnail:', error);
            }
        };

        regenerateDefaultCardBackThumbnail();
    }, [defaultCardBackBleed, cardWidth, cardHeight]);

    // Reorder cards when groupByCardBacks is toggled
    useEffect(() => {
        if (!groupByCardBacks || cardOrder.length === 0) return;

        // Group cards: custom backs first, then default backs
        const reorderedCards = [...cardOrder].sort((aId, bId) => {
            const cardA = cardMap.get(aId);
            const cardB = cardMap.get(bId);

            if (!cardA || !cardB) return 0;

            const aHasCustomBack = cardA.cardBackUrl !== undefined;
            const bHasCustomBack = cardB.cardBackUrl !== undefined;

            // If both have custom backs or both use default, maintain relative order
            if (aHasCustomBack === bHasCustomBack) return 0;

            // Custom backs come first
            return aHasCustomBack ? -1 : 1;
        });

        // Only update if the order actually changed
        const orderChanged = reorderedCards.some((id, index) => id !== cardOrder[index]);
        if (orderChanged) {
            setCardOrder(reorderedCards);
        }
    }, [groupByCardBacks, cardMap, cardOrder]);

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
                useCustomBleed: false,
                cardBackBleed: defaultCardBackBleed,
                useCustomCardBackBleed: false,
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
        let cardIdInstances = cardOrder.filter((card) => card === cardId)

        if (cardIdInstances.length === 1) {
            // Remove the card itself if this is the last instance of it being removed
            let card = cardMap.get(cardId);
            if (card) {
                URL.revokeObjectURL(card.imageUrl);
                if (card.thumbnailUrl) {
                    URL.revokeObjectURL(card.thumbnailUrl);
                }
                if (card.cardBackUrl) {
                    URL.revokeObjectURL(card.cardBackUrl);
                }
                if (card.cardBackThumbnailUrl) {
                    URL.revokeObjectURL(card.cardBackThumbnailUrl);
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
            if (card.cardBackUrl) {
                URL.revokeObjectURL(card.cardBackUrl);
            }
            if (card.cardBackThumbnailUrl) {
                URL.revokeObjectURL(card.cardBackThumbnailUrl);
            }
        }
        setCardMap(new Map());
        setCardOrder([]);
    }

    const handleUpdateBleed = async (cardId: string, bleed: number) => {
        const card = cardMap.get(cardId);
        if (!card) return;

        // Set loading state immediately and mark as using custom bleed
        setCardMap((prev) => {
            const newMap = new Map(prev);
            newMap.set(cardId, { ...card, bleed, useCustomBleed: true, thumbnailLoading: true });
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

    const handleUpdateCardBackBleed = async (cardId: string, bleed: number) => {
        const card = cardMap.get(cardId);
        if (!card) return;

        // If there's no card back uploaded yet, just update the bleed value
        if (!card.cardBackUrl) {
            setCardMap((prev) => {
                const newMap = new Map(prev);
                newMap.set(cardId, { ...card, cardBackBleed: bleed, useCustomCardBackBleed: true });
                return newMap;
            });
            return;
        }

        // Set loading state immediately and mark as using custom back bleed
        setCardMap((prev) => {
            const newMap = new Map(prev);
            newMap.set(cardId, { ...card, cardBackBleed: bleed, useCustomCardBackBleed: true, cardBackThumbnailLoading: true });
            return newMap;
        });

        try {
            // Fetch the original card back image blob from the blob URL
            const response = await fetch(card.cardBackUrl);
            const blob = await response.blob();
            const file = new File([blob], `${card.name || 'card'}-back.jpg`, { type: blob.type });

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
            if (card.cardBackThumbnailUrl) {
                URL.revokeObjectURL(card.cardBackThumbnailUrl);
            }

            // Update card with new bleed and thumbnail
            setCardMap((prev) => {
                const newMap = new Map(prev);
                const currentCard = newMap.get(cardId);
                if (currentCard) {
                    newMap.set(cardId, {
                        ...currentCard,
                        cardBackThumbnailUrl: newThumbnailUrl,
                        cardBackThumbnailLoading: false
                    });
                }
                return newMap;
            });
        } catch (error) {
            console.error('Failed to regenerate card back thumbnail with new bleed:', error);
            // Fall back to just updating the bleed value and clearing loading state
            setCardMap((prev) => {
                const newMap = new Map(prev);
                const currentCard = newMap.get(cardId);
                if (currentCard) {
                    newMap.set(cardId, { ...currentCard, cardBackThumbnailLoading: false });
                }
                return newMap;
            });
        }
    };

    const handleDuplicateCard = (cardToDuplicate: CardImage, count: number = 1, insertAtIndex?: number) => {
        // Duplicates reuse the same card ID - they appear once in cardMap, multiple times in cardOrder
        // Create array of card IDs (all the same) for the order array
        const duplicateIds: string[] = new Array(count).fill(cardToDuplicate.id);

        // No need to update cardMap - the card already exists there
        // Just update cardOrder to include the duplicate references

        // Single state update for cardOrder - insert at specified index or append to end
        setCardOrder((prev) => {
            if (insertAtIndex !== undefined && insertAtIndex >= 0 && insertAtIndex <= prev.length) {
                // Insert at the specified index
                const newOrder = [...prev];
                newOrder.splice(insertAtIndex, 0, ...duplicateIds);
                return newOrder;
            } else {
                // Append to the end
                return [...prev, ...duplicateIds];
            }
        });
    };

    const handleUpdateCardBack = async (cardId: string, file: File | null) => {
        const card = cardMap.get(cardId);
        if (!card) return;

        // Clean up old card back URLs if they exist
        if (card.cardBackUrl) {
            URL.revokeObjectURL(card.cardBackUrl);
        }
        if (card.cardBackThumbnailUrl) {
            URL.revokeObjectURL(card.cardBackThumbnailUrl);
        }

        // If file is null, we're removing the custom back
        if (!file) {
            setCardMap((prev) => {
                const newMap = new Map(prev);
                newMap.set(cardId, {
                    ...card,
                    cardBackUrl: undefined,
                    cardBackThumbnailUrl: undefined,
                    cardBackThumbnailLoading: false
                });
                return newMap;
            });
            return;
        }

        // Create a new object URL for the card back
        const cardBackUrl = URL.createObjectURL(file);

        // Set loading state immediately with the original URL
        setCardMap((prev) => {
            const newMap = new Map(prev);
            newMap.set(cardId, {
                ...card,
                cardBackUrl,
                cardBackThumbnailLoading: true
            });
            return newMap;
        });

        // Generate thumbnail asynchronously
        try {
            const generateThumbnail = () => {
                return createThumbnail(file, 800, 800, 0.85, card.cardBackBleed, cardWidth, cardHeight);
            };

            const cardBackThumbnailUrl = await new Promise<string>((resolve, reject) => {
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

            // Update card with thumbnail
            setCardMap((prev) => {
                const newMap = new Map(prev);
                const currentCard = newMap.get(cardId);
                if (currentCard) {
                    newMap.set(cardId, {
                        ...currentCard,
                        cardBackThumbnailUrl,
                        cardBackThumbnailLoading: false
                    });
                }
                return newMap;
            });
        } catch (error) {
            console.error('Failed to generate card back thumbnail:', error);
            // Clear loading state even if failed
            setCardMap((prev) => {
                const newMap = new Map(prev);
                const currentCard = newMap.get(cardId);
                if (currentCard) {
                    newMap.set(cardId, {
                        ...currentCard,
                        cardBackThumbnailLoading: false
                    });
                }
                return newMap;
            });
        }
    };

    const handleUpdateDefaultCardBack = async (file: File | null) => {
        // Clean up old URLs
        if (defaultCardBackUrl) {
            URL.revokeObjectURL(defaultCardBackUrl);
        }
        if (defaultCardBackThumbnailUrl) {
            URL.revokeObjectURL(defaultCardBackThumbnailUrl);
        }

        // If file is null, we're removing the default card back
        if (!file) {
            setDefaultCardBackUrl(null);
            setDefaultCardBackThumbnailUrl(null);
            defaultCardBackFileRef.current = null;
            return;
        }

        // Store the file for future thumbnail regeneration
        defaultCardBackFileRef.current = file;

        // Create blob URL for the original
        const cardBackUrl = URL.createObjectURL(file);
        setDefaultCardBackUrl(cardBackUrl);

        // Generate thumbnail asynchronously
        try {
            const generateThumbnail = () => {
                return createThumbnail(file, 800, 800, 0.85, defaultCardBackBleed, cardWidth, cardHeight);
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

            setDefaultCardBackThumbnailUrl(thumbnailUrl);
        } catch (error) {
            console.error('Failed to generate default card back thumbnail:', error);
        }
    };

    // Compute a state fingerprint to detect changes
    const computeCurrentState = () => {
        const cardsArray = cardOrder.map(id => cardMap.get(id)).filter((card): card is CardImage => card !== undefined);

        // Create a fingerprint of the current state
        const stateObj = {
            cardOrder,
            cards: cardsArray.map(card => ({
                id: card.id,
                imageUrl: card.imageUrl,
                bleed: card.bleed,
                cardBackUrl: card.cardBackUrl,
                cardBackBleed: card.cardBackBleed,
            })),
            enableCardBacks,
            defaultCardBackUrl,
            cardWidth,
            cardHeight,
            outputBleed,
            pageSize: Array.from(pageSize)[0],
        };

        return JSON.stringify(stateObj);
    };

    const handleGeneratePDF = async () => {
        if (!pdfManagerRef.current || cardOrder.length === 0 || isGenerating) {
            return;
        }

        // Check if state has changed since last generation
        const currentState = computeCurrentState();
        const hasChanges = currentState !== lastGeneratedStateRef.current;

        // If no changes and PDF already exists, just download it
        if (!hasChanges && pdfUrl) {
            handleDownloadPDF();
            return;
        }

        // State has changed or no PDF exists, regenerate
        setIsGenerating(true);
        setGenerationProgress(0);
        try {
            // Convert map + order back to array for PDF generation
            const cardsArray = cardOrder.map(id => cardMap.get(id)).filter((card): card is CardImage => card !== undefined);
            const pdfUrlResult = await pdfManagerRef.current.generatePDF(cardsArray, enableCardBacks, defaultCardBackUrl);
            const dxfUrlResult = pdfManagerRef.current.getCachedDxfUrl();
            setPdfUrl(pdfUrlResult);
            setDxfUrl(dxfUrlResult);

            // Store the current state as the last generated state
            lastGeneratedStateRef.current = currentState;

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
        defaultCardBackBleed,
        outputBleed,
        enableCardBacks,
        defaultCardBackUrl,
        defaultCardBackThumbnailUrl,
        groupByCardBacks,
        showAllCardBacks,
        handleFilesSelected: handleAddCards,
        handleRemoveCard,
        handleRemoveAllCards,
        handleUpdateBleed,
        handleUpdateCardBackBleed,
        handleDuplicateCard,
        handleUpdateCardBack,
        handleGeneratePDF,
        handleDownloadPDF,
        handleDownloadDXF,
        setPageSize,
        setCardWidth,
        setCardHeight,
        setDefaultBleed,
        setDefaultCardBackBleed,
        setEnableCardBacks,
        handleUpdateDefaultCardBack,
        setGroupByCardBacks,
        setShowAllCardBacks,
        setOutputBleed,
        setCardMap,
        setCardOrder,
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
