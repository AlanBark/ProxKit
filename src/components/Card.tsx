import { Trash2, Plus, ChevronUp } from "lucide-react";
import { Button, NumberInput } from "@heroui/react";
import { useState } from "react";
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
    const [isClicked, setIsClicked] = useState(false);

    const { handleRemoveCard, handleUpdateBleed, handleDuplicateCard } = useApp()

    const menuState: MenuState = isClicked ? "ACTIVE" : isHovered ? "HOVER" : "NONE";

    // Return empty div if no card
    if (!card) {
        return <div className="relative w-full h-full bg-gray-100" />;
    }

    // Calculate the scale factor to account for bleed
    // We need to scale up the image so that when the container clips it,
    // the visible area shows the correct content
    const scaleX = (cardWidth + 2 * card.bleed) / cardWidth;
    const scaleY = (cardHeight + 2 * card.bleed) / cardHeight;

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                setIsClicked(false);
            }}
            className="relative flex flex-col overflow-hidden"
            style={{

                borderRadius: "2.5mm",
            }}
        >
                <img
                    src={card.imageUrl}
                    alt={card.name || `Card ${card.id}`}
                    className="object-cover"
                    style={{
                        alignSelf: gridPosition >= 0 && gridPosition <= 3 ? 'flex-end' : 'flex-start',
                        transform: `scale(${scaleX}, ${scaleY})`
                    }}
                />

                {/* Duplicate and Remove Buttons - Fade in/out */}
                {false && (

                <div
                    className={`absolute inset-0 gap-[8%] flex items-center justify-center transition-opacity duration-200 ease-in-out ${
                        isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                >
                    <Button
                        isIconOnly
                        size="lg"
                        color="primary"
                        onPress={() => handleDuplicateCard(card)}
                        className="w-[28%] h-[20%] min-w-10 min-h-10"
                        title="Duplicate card"
                    >
                        <Plus className="w-[50%] h-[50%]" />
                    </Button>
                    <Button
                        isIconOnly
                        size="lg"
                        color="danger"
                        onPress={() => handleRemoveCard(cardIndex)}
                        className="w-[28%] h-[20%] min-w-10 min-h-10"
                        title="Delete card"
                    >
                        <Trash2 className="w-[30%] h-[30%]" />
                    </Button>
                </div>
                )}

                {/* Sliding Menu - Slides up/down on hover */}
                {false && (
                <div
                    className="absolute left-0 right-0 top-0 bottom-0 bg-primary-100 backdrop-blur-sm transition-all duration-150 ease-in-out"
                    style={{
                        transform: isHovered
                            ? 'translateY(0)'
                            : 'translateY(100%)',
                        clipPath: menuState === "ACTIVE"
                            ? 'inset(0 0 0 0)'
                            : 'inset(calc(100% - 2.5rem) 0 0 0)'
                    }}
                >
                    {/* Chevron Button - Always visible at bottom when collapsed, top when expanded */}
                    <div
                        className={`absolute w-full flex items-center justify-center p-2 cursor-pointer transition-all duration-300 ${
                            menuState === "ACTIVE" ? 'top-0' : 'bottom-0'
                        }`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsClicked(!isClicked);
                        }}
                    >
                        <ChevronUp
                            className={`w-4 h-4 text-primary-foreground transition-transform duration-300 ${
                                menuState === "ACTIVE" ? 'rotate-180' : ''
                            }`}
                        />
                    </div>

                    {/* Expanded Menu Content */}
                    {menuState === "ACTIVE" && (
                        <div className="flex flex-col gap-3 p-4 pt-12 h-full">
                            <NumberInput
                            label="Card Bleed"
                            value={card.bleed}
                            onValueChange={(value) => {
                                handleUpdateBleed(card.id, value);
                            }}
                            min={10}
                            max={300}
                            step={0.1}
                            size="sm"
                            variant="flat"
                            radius="sm"
                            labelPlacement="outside"
                            endContent={
                                <span className="text-default-400 text-xs pointer-events-none shrink-0">mm</span>
                            }
                        />
                        </div>
                    )}
                </div>
                )}
        </div>
    );
}
