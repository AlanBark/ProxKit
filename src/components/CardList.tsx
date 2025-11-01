import { Card } from "./Card";
import { Pagination, Button } from "@heroui/react";
import { textStyles } from "../theme/classNames";
import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Box } from "./Box";

// @TODO dynamic somehow
const CARDS_PER_PAGE = 8;

// The main goal here is to display a whole page of cards, without compromising card aspect ratio

export function CardList() {

    const [currentPage, setCurrentPage] = useState(1);
    const {
        cardMap,
        cardOrder,
        cardWidth,
        cardHeight
    } = useApp();

    const totalPages = Math.ceil(cardOrder.length / CARDS_PER_PAGE);

    const currentPageCards = useMemo(() => {
        const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
        const endIndex = startIndex + CARDS_PER_PAGE;
        return cardOrder.slice(startIndex, endIndex);
    }, [cardOrder, currentPage]);

    // Go back a page if required
    if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(totalPages);
    }

    return (
        <div className="flex h-full">
            <div className="my-6 mr-6 flex-1 flex items-center justify-center gap-4">
                <Box className="h-full flex flex-col justify-between">
                    <div className="flex items-center justify-center ">
                        <Button
                            isIconOnly
                            variant="light"
                            onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
                            isDisabled={currentPage === 1}
                            aria-label="Previous page"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <div
                            className=""
                            style={{
                                width: `min(90vw, calc(100vh - 8rem) * ${(4 * cardWidth + 6) / (2 * cardHeight + 1)})`,
                                height: `min(calc(100vh - 8rem), 90vw * ${(2 * cardHeight + 1) / (4 * cardWidth + 3)})`,

                            }}>
                            {cardOrder.length === 0 || !cardOrder ? (
                                <div className={`flex flex-col items-center justify-center h-full ${textStyles.muted}`}>
                                    <ImageIcon className="w-24 h-24 mb-4 opacity-30" />
                                    <p className="text-lg">No cards yet</p>
                                    <p className="text-sm mt-1">Upload images to get started</p>
                                </div>) : (
                                <div className="grid grid-cols-4 grid-rows-2 gap-4">
                                    {currentPageCards.map((cardId, index) => {
                                        const globalIndex = (currentPage - 1) * CARDS_PER_PAGE + index;
                                        return (
                                            <Card
                                                card={cardMap.get(cardId)}
                                                cardIndex={globalIndex}
                                                gridPosition={index}
                                                key={`${cardId}-${globalIndex}`}
                                            />
                                        );
                                    })}
                                </div>
                                )}
                            </div>
                        <Button
                            isIconOnly
                            variant="light"
                            onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            isDisabled={currentPage === totalPages}
                            aria-label="Next page"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </Button>
                    </div>
                    {(cardOrder.length > 0) && 
                        <div className="flex justify-center pt-3">
                            <Pagination
                                total={totalPages}
                                page={currentPage}
                                onChange={setCurrentPage}
                                size="sm"
                                variant="light"
                            />
                        </div>
                    }
                </Box>
            </div>
        </div>
    )
}
