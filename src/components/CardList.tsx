import { Card } from "./Card";
import type { CardImage } from "../types/card";
import { Pagination } from "@heroui/react";
import { useState, useMemo } from "react";

interface CardListProps {
    cards: CardImage[];
    onRemoveCard: (cardId: string) => void;
    onUpdateBleed: (cardId: string, bleed: number) => void;
    onDuplicateCard: (card: CardImage) => void;
}

const CARDS_PER_PAGE = 8;

export function CardList({ cards, onRemoveCard, onUpdateBleed, onDuplicateCard }: CardListProps) {
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.ceil(cards.length / CARDS_PER_PAGE);

    const paginatedCards = useMemo(() => {
        const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
        const endIndex = startIndex + CARDS_PER_PAGE;
        return cards.slice(startIndex, endIndex);
    }, [cards, currentPage]);

    // Reset to page 1 if current page becomes invalid
    if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(1);
    }

    return (
        <div className="flex flex-col h-full">
            {/* Cards Grid */}
            <div className="flex-1 grid grid-cols-4 auto-rows-fr gap-4 min-h-0">
                {paginatedCards.map((card) => (
                    <Card
                        key={card.id}
                        card={card}
                        onRemoveCard={onRemoveCard}
                        onUpdateBleed={onUpdateBleed}
                        onDuplicateCard={onDuplicateCard}
                    />
                ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-center py-4 shrink-0">
                    <Pagination
                        total={totalPages}
                        page={currentPage}
                        onChange={setCurrentPage}
                        showControls
                        size="sm"
                    />
                </div>
            )}
        </div>
    );
}
