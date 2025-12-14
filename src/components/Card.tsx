import { Trash2, Plus, Loader2, RotateCcw, Upload, Menu } from "lucide-react";
import { Button, ButtonGroup, Input, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { useState, useRef, useEffect, useCallback } from "react";
import type { CardImage } from "../types/card";
import { usePrintAndCutStore } from "../stores/printAndCutStore";
import { useCardBleedUpdates } from "../hooks/useCardBleedUpdates";
import { useCardBackManagement } from "../hooks/useCardBackManagement";
import { removeCard, duplicateCard } from "../utils/cardOperations";

interface CardProps {
    cardIndex: number,
    card: CardImage | undefined;
    gridPosition: number
}

export function Card({ card, cardIndex }: CardProps) {

    // Get settings from store
    const cardWidth = usePrintAndCutStore((state) => state.cardWidth);
    const cardHeight = usePrintAndCutStore((state) => state.cardHeight);
    const showAllCardBacks = usePrintAndCutStore((state) => state.showAllCardBacks);
    const defaultCardBackUrl = usePrintAndCutStore((state) => state.defaultCardBackUrl);
    const defaultCardBackThumbnailUrl = usePrintAndCutStore((state) => state.defaultCardBackThumbnailUrl);
    const cardMap = usePrintAndCutStore((state) => state.cardMap);
    const cardOrder = usePrintAndCutStore((state) => state.cardOrder);
    const setCardMap = usePrintAndCutStore((state) => state.setCardMap);
    const setCardOrder = usePrintAndCutStore((state) => state.setCardOrder);

    // Get hooks for card operations
    const { handleUpdateBleed, handleUpdateCardBackBleed } = useCardBleedUpdates();
    const { handleUpdateCardBack } = useCardBackManagement();

    const [isHovered, setIsHovered] = useState(false);
    const [isMouseOver, setIsMouseOver] = useState(false);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);
    const [duplicateCount, setDuplicateCount] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Create handlers using the utility functions
    const handleRemoveCard = useCallback((cardIndex: number) => {
        const { cardMap: newCardMap, cardOrder: newCardOrder } = removeCard(cardIndex, cardMap, cardOrder);
        setCardMap(newCardMap);
        setCardOrder(newCardOrder);
    }, [cardMap, cardOrder, setCardMap, setCardOrder]);

    const handleDuplicateCard = useCallback((card: CardImage, count: number = 1, insertAtIndex?: number) => {
        const newCardOrder = duplicateCard(card.id, count, cardOrder, insertAtIndex);
        setCardOrder(newCardOrder);
    }, [cardOrder, setCardOrder]);

    // Flip card when showAllCardBacks is toggled
    useEffect(() => {
        setIsFlipped(showAllCardBacks);
    }, [showAllCardBacks]);

    // Return empty div if no card
    if (!card) {
        return <div className="relative w-full h-full bg-(--bg-input)" />;
    }

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            handleUpdateCardBack(card.id, files[0]);
        }
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleUploadCardBack = () => {
        fileInputRef.current?.click();
    };

    // Determine what to show on the back - use thumbnail if available, otherwise original
    const cardBackImage = card.cardBackThumbnailUrl || card.cardBackUrl || defaultCardBackThumbnailUrl || defaultCardBackUrl;

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
            />
            <div
                onMouseEnter={() => {
                    setIsHovered(true);
                    setIsMouseOver(true);
                }}
                onMouseLeave={() => {
                    setIsMouseOver(false);
                    if (!isOptionsOpen) {
                        setIsHovered(false);
                    }
                }}
                className="relative flex flex-col overflow-hidden justify-center"
                style={{
                    width: '100%',
                    height: '100%',
                    aspectRatio: cardWidth / cardHeight,
                    perspective: '1000px',
                }}
            >
            {/* Card flip container */}
            <div
                className="relative w-full h-full transition-transform duration-500"
                style={{
                    transformStyle: 'preserve-3d',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
            >
                {/* Front of card */}
                <div
                    className="absolute inset-0"
                    style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                    }}
                >
                    {card.imageUrl ? (
                        <>
                            <img
                                src={card.thumbnailUrl || card.imageUrl}
                                alt={card.name || `Card ${card.id}`}
                                className="w-full h-full"
                                loading="eager"
                                decoding="async"
                                style={{
                                    objectFit: 'contain',
                                    objectPosition: 'center',
                                    contentVisibility: 'auto',
                                    imageRendering: 'auto',
                                    borderRadius: "3mm",
                                }}
                            />

                            {/* Loading spinner while thumbnail is being generated */}
                            {card.thumbnailLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                                    <Loader2 className="w-12 h-12 text-white animate-spin" />
                                </div>
                            )}
                        </>
                    ) : (
                        /* Skeleton loading state for downloading images */
                        <div className="absolute inset-0 flex items-center justify-center bg-(--bg-input) animate-pulse">
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-12 h-12 text-(--text-secondary) animate-spin" />
                                {card.name && (
                                    <p className="text-xs text-(--text-muted) text-center px-2 max-w-full overflow-hidden text-ellipsis">
                                        {card.name}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Back of card */}
                <div
                    className="absolute inset-0"
                    style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                    }}
                >
                    {cardBackImage ? (
                        <>
                            <img
                                src={cardBackImage}
                                alt="Card back"
                                className="w-full h-full"
                                loading="eager"
                                decoding="async"
                                style={{
                                    objectFit: 'contain',
                                    objectPosition: 'center',
                                    borderRadius: "3mm",
                                }}
                            />
                            {/* Loading spinner while card back thumbnail is being generated */}
                            {card.cardBackThumbnailLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                                    <Loader2 className="w-12 h-12 text-white animate-spin" />
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-(--bg-input)" style={{ borderRadius: "3mm" }}>
                            <span className="text-(--text-muted) text-sm">No card back</span>
                        </div>
                    )}
                </div>
            </div>
            <div
                className={`absolute inset-0 gap-[8%] flex flex-col items-center justify-end transition-opacity  ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
            >
                <div className="h-full w-full flex items-end justify-between p-2" style={
                    {
                        background: 'linear-gradient(0deg, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 1) 15%, rgba(90 , 90, 90, 0.1) 50%)',
                        borderRadius: '3mm',
                        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                        borderTop: '1px solid rgba(255, 255, 255, 0.25)',
                        borderLeft: '1px solid rgba(255, 255, 255, 0.25)',
                        borderRight: '1px solid rgba(255, 255, 255, 0.25)',
                    }}>
                    <ButtonGroup variant="light">
                        <Button
                            isIconOnly
                            color="danger"
                            onPress={() => handleRemoveCard(cardIndex)}
                            title="Delete card"
                            variant="light"
                        >
                            <Trash2 />
                        </Button>

                        <Button
                            isIconOnly
                            color="secondary"
                            variant="light"
                            title="Flip Card"
                            onPress={() => setIsFlipped(!isFlipped)}
                        >
                            <RotateCcw
                                className="transition-transform duration-500"
                                style={{ transform: isFlipped ? 'rotate(180deg)' : 'rotate(0deg)' }}
                            />
                        </Button>
                        
                    </ButtonGroup>

                    <div className="flex gap-1 items-center pb-4">
                            <div
                                className={`w-2 h-2 rounded-full transition-colors duration-300 ${!isFlipped ? 'bg-(--primary)' : 'bg-(--text-muted)'}`}
                            />
                            <div
                                className={`w-2 h-2 rounded-full transition-colors duration-300 ${isFlipped ? 'bg-(--primary)' : 'bg-(--text-muted)'}`}
                            />
                        </div>

                    <ButtonGroup variant="light">
                        <Button
                            isIconOnly
                            color="primary"
                            onPress={() => handleDuplicateCard(card, 1, cardIndex + 1)}
                            title="Duplicate card"
                            variant="light"
                        >
                            <Plus />
                        </Button>
                        <Popover showArrow offset={10} placement="top-end" isOpen={isOptionsOpen} onOpenChange={(open) => {
                            setIsOptionsOpen(open);
                            // If closing the popover and mouse is not over the card, hide the hover state
                            if (!open && !isMouseOver) {
                                setIsHovered(false);
                            }
                        }}
                        >
                            <PopoverTrigger>
                                <Button isIconOnly color="primary">
                                    <Menu />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent>
                                <div className="flex flex-col gap-4 p-2">
                                    {/* Main Image Bleed */}
                                        <Input
                                            label="Front Bleed"
                                            labelPlacement="outside"
                                            type="number"
                                            size="sm"
                                            variant="bordered"
                                            value={card.bleed.toString()}
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value);
                                                if (!isNaN(value) && value >= 0) {
                                                    handleUpdateBleed(card.id, value);
                                                }
                                            }}
                                            step="0.1"
                                            min="0"
                                            endContent={
                                                <p className="text-sm text-(--text-secondary)">mm</p>
                                            }
                                            description="Input bleed - This card only"
                                        />

                                        <Input
                                            label="Back Bleed"
                                            labelPlacement="outside"
                                            type="number"
                                            size="sm"
                                            variant="bordered"
                                            value={card.cardBackBleed.toString()}
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value);
                                                if (!isNaN(value) && value >= 0) {
                                                    handleUpdateCardBackBleed(card.id, value);
                                                }
                                            }}
                                            step="0.1"
                                            min="0"
                                            endContent={
                                                <p className="text-sm text-(--text-secondary)">mm</p>
                                            }
                                            description="Input bleed - This card only"
                                        />

                                    {/* Card Back Image File Select */}
                                    <div className="flex items-center">
                                        <Button
                                            size="sm"
                                            color="primary"
                                            variant="flat"
                                            onPress={handleUploadCardBack}
                                            className="flex-1"
                                        >
                                            <Upload className="w-4 h-4" />
                                            {card.cardBackUrl ? 'Change Card Back' : 'Upload Card Back'}
                                        </Button>
                                        {card.cardBackUrl && (
                                            <Button
                                                size="sm"
                                                color="danger"
                                                variant="flat"
                                                isIconOnly
                                                onPress={() => handleUpdateCardBack(card.id, null)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>

                                    {/* Multiple Duplicate */}
                                    <div className="flex items-center">
                                        <Input
                                            placeholder="Add X Copies"
                                            size="sm"
                                            variant="bordered"
                                            classNames={{ inputWrapper: ["rounded-r-none"] }}
                                            value={duplicateCount}
                                            onChange={(e) => setDuplicateCount(e.target.value)}
                                            type="number"
                                            min="1"
                                            className="flex-1"
                                        />
                                        <Button
                                            isIconOnly
                                            size="sm"
                                            color="primary"
                                            variant="shadow"
                                            onPress={() => {
                                                const count = parseInt(duplicateCount);
                                                if (!isNaN(count) && count > 0) {
                                                    handleDuplicateCard(card, count, cardIndex + 1);
                                                    setDuplicateCount("");
                                                    setIsOptionsOpen(false);
                                                }
                                            }}
                                        >
                                            <Plus />
                                        </Button>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </ButtonGroup>
                </div>
            </div>
        </div>
        </>
    );
}
