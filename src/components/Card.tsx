import { Trash2, Plus, ChevronUp, Loader2, RotateCcw, Upload, ChevronDown } from "lucide-react";
import { Button, ButtonGroup, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Input, NumberInput, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { useState, useRef } from "react";
import type { CardImage } from "../types/card";
import { useApp } from "../context/AppContext";

interface CardProps {
    cardIndex: number,
    card: CardImage | undefined;
    gridPosition: number
}

type MenuState = "NONE" | "HOVER" | "ACTIVE"

export function Card({ card, cardIndex, gridPosition }: CardProps) {

    const { cardWidth, cardHeight } = useApp();
    const [isHovered, setIsHovered] = useState(false);
    const [isMouseOver, setIsMouseOver] = useState(false);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);
    const [duplicateCount, setDuplicateCount] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { handleRemoveCard, handleUpdateBleed, handleDuplicateCard, handleUpdateCardBack, defaultCardBackUrl } = useApp()

    // Return empty div if no card
    if (!card) {
        return <div className="relative w-full h-full bg-gray-100" />;
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleUpdateCardBack(card.id, file);
        }
    };

    // Determine what to show on the back
    const cardBackImage = card.cardBackUrl || defaultCardBackUrl;

    return (
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
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-300" style={{ borderRadius: "3mm" }}>
                            <span className="text-gray-600 text-sm">No card back</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Duplicate and Remove Buttons - Fade in/out - only on front */}
            {!isFlipped && (
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
                        <Button
                            isIconOnly
                            color="danger"
                            onPress={() => handleRemoveCard(cardIndex)}
                            title="Delete card"
                            variant="light"
                        >
                            <Trash2 />
                        </Button>

                        <ButtonGroup variant="light">
                            <Button
                                isIconOnly
                                color="primary"
                                onPress={() => handleDuplicateCard(card, 1)}
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
                            }}>
                                <PopoverTrigger>
                                    <Button isIconOnly color="primary">
                                        <ChevronUp
                                            className="transition-transform duration-200"
                                            style={{ transform: isOptionsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                        />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent>
                                    <div className="my-2 flex w-full">
                                        <Input
                                            placeholder="Add More"
                                            size="sm"
                                            variant="bordered"
                                            classNames={{inputWrapper: [ "rounded-r-none" ]}}
                                            value={duplicateCount}
                                            onChange={(e) => setDuplicateCount(e.target.value)}
                                            type="number"
                                        />
                                        <Button
                                            isIconOnly
                                            size="sm"
                                            color="primary"
                                            variant="shadow"
                                            onPress={() => {
                                                const count = parseInt(duplicateCount);
                                                if (!isNaN(count) && count > 0) {
                                                    handleDuplicateCard(card, count);
                                                    setDuplicateCount("");
                                                    setIsOptionsOpen(false);
                                                }
                                            }}
                                        >
                                            <Plus />
                                        </Button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </ButtonGroup>
                    </div>
                    {/* <div className="flex gap-[8%]">
                        <Button
                            isIconOnly
                            size="lg"
                            color="primary"
                            onPress={() => handleDuplicateCard(card)}
                            className="w-[28%] min-w-10 h-[20%] min-h-10"
                            title="Duplicate card"
                        >
                            <Plus className="w-[50%] h-[50%]" />
                        </Button>
                        <Button
                            isIconOnly
                            size="lg"
                            color="danger"
                            onPress={() => handleRemoveCard(cardIndex)}
                            className="w-[28%] min-w-10 h-[20%] min-h-10"
                            title="Delete card"
                        >
                            <Trash2 className="w-[30%] h-[30%]" />
                        </Button>
                    </div>
                    <Button
                        isIconOnly
                        size="lg"
                        color="secondary"
                        onPress={() => setIsFlipped(true)}
                        className="w-[28%] min-w-10 h-[20%] min-h-10"
                        title="Flip card"
                    >
                        <RotateCcw className="w-[40%] h-[40%]" />
                    </Button> */}
                </div>
            )}

            {/* Flip back and Upload buttons when showing back */}
            {isFlipped && (
                <div
                    className={`absolute inset-0 gap-[8%] flex items-center justify-center transition-opacity duration-200 ease-in-out ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}
                >
                    <Button
                        isIconOnly
                        size="lg"
                        color="secondary"
                        onPress={() => fileInputRef.current?.click()}
                        className="w-[28%] min-w-10 h-[20%] min-h-10"
                        title="Upload card back"
                    >
                        <Upload className="w-[40%] h-[40%]" />
                    </Button>
                    <Button
                        isIconOnly
                        size="lg"
                        color="primary"
                        onPress={() => setIsFlipped(false)}
                        className="w-[28%] min-w-10 h-[20%] min-h-10"
                        title="Flip to front"
                    >
                        <RotateCcw className="w-[40%] h-[40%]" />
                    </Button>
                </div>
            )}

            {/* Hidden file input for uploading card back */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
            />
        </div>
    );
}
