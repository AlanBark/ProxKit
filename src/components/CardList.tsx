import { Card } from "./Card";
import type { CardImage } from "../types/card";
import { Pagination } from "@heroui/react";
import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";

interface CardListProps {
    cards: CardImage[];
}

const CARDS_PER_PAGE = 8;

export function CardList({ cards }: CardListProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const { cardWidth, cardHeight } = useApp();

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

    const aspectRatio = cardWidth / cardHeight;

    return (
        <div className="flex flex-col h-full">
            {/* Cards Grid - Grid constrained to show exactly 2 rows without overflow */}
            <div className="flex-1 grid grid-cols-4 grid-rows-2 auto-rows-fr gap-4 p-1 min-h-0">
                {paginatedCards.map((card, index) => (
                    <div
                        key={card.id}
                        className="w-full h-full min-h-0"
                    >
                        <div
                            className="w-full h-full max-h-full"
                            style={{
                                aspectRatio: aspectRatio.toString(),
                                objectFit: 'contain'
                            }}
                        >
                            <Card
                                card={card}
                                cardIndex={index}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-center py-2 shrink-0">
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
