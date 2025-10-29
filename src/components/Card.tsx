import { Trash2, Plus, ChevronUp } from "lucide-react";
import { Button, NumberInput, Image } from "@heroui/react";
import { useState } from "react";
import type { CardImage } from "../types/card";
import { useApp } from "../context/AppContext";

interface CardProps {
    cardIndex: number,
    card: CardImage;
}

type MenuState = "NONE" | "HOVER" | "ACTIVE"

export function Card({ card, cardIndex }: CardProps) {
    const { cardWidth, cardHeight } = useApp();
    const [isHovered, setIsHovered] = useState(false);
    const [isClicked, setIsClicked] = useState(false);
    
    const { handleRemoveCard, handleUpdateBleed, handleDuplicateCard } = useApp()

    const menuState: MenuState = isClicked ? "ACTIVE" : isHovered ? "HOVER" : "NONE";

    // Calculate the crop percentage based on bleed
    // If bleed is 3mm, we need to crop 3mm from each side
    // Crop percentage = (bleed / dimension) * 100
    const cropXPercent = (card.bleed / cardWidth) * 100;
    const cropYPercent = (card.bleed / cardHeight) * 100;

    return (
        <div
            className={`rounded-xl overflow-hidden transition-all group h-full w-full`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                setIsClicked(false);
            }}
        >
            {/* Card Image */}
            <div className={`relative w-full h-full overflow-hidden cursor-pointer flex items-center justify-center`}>
                <Image
                    src={card.imageUrl}
                    alt={card.name || `Card ${card.id}`}
                    classNames={{
                        wrapper: "w-full h-full",
                        img: "w-full h-full object-cover z-0"
                    }}
                    style={{
                        clipPath: `inset(${cropYPercent}% ${cropXPercent}% ${cropYPercent}% ${cropXPercent}%)`,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        scale: `${1 + (card.bleed * 2) / Math.min(cardWidth, cardHeight)}`
                    }}
                />

                {/* Duplicate and Remove Buttons - Fade in/out */}
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
        </div>
    );
}
