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

    // The grid will be a rectangle with LxW ratio of:
    const aspectRatio = (4 * cardWidth) / (2 * cardHeight);

    return (
        <div className="flex h-full">
            <div className="my-6 mr-6 flex-1 flex items-center justify-center gap-4">
                <Box className="h-full flex flex-col justify-between">
                    <div className="flex-1 flex items-center justify-center ">
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
                            className="flex items-center justify-center flex-1"
                            style={{
                                minHeight: 0,
                                minWidth: 0,
                            }}>
                            <div style={{
                                aspectRatio: aspectRatio,
                                maxWidth: '100%',
                                maxHeight: '100%',
                                width: 'fit-content',
                                height: 'fit-content',
                            }}>
                            {cardOrder.length === 0 || !cardOrder ? (
                                <div className={`flex flex-col items-center justify-center ${textStyles.muted}`}
                                    style={{
                                        width: `min(90vw, calc((100vh - 12rem) * ${aspectRatio}))`,
                                        height: `calc(min(90vw, calc((100vh - 12rem) * ${aspectRatio})) / ${aspectRatio})`,
                                    }}>
                                    <ImageIcon className="w-24 h-24 mb-4 opacity-30" />
                                    <p className="text-lg">No cards yet</p>
                                    <p className="text-sm mt-1">Upload images to get started</p>
                                </div>) : (
                                <div
                                    className="grid grid-cols-4 grid-rows-2 gap-2"
                                    style={{
                                        width: `min(90vw, calc((100vh - 12rem) * ${aspectRatio}))`,
                                        height: `calc(min(90vw, calc((100vh - 12rem) * ${aspectRatio})) / ${aspectRatio})`,
                                    }}
                                >
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
                                className="cursor-pointer"
                            />
                        </div>
                    }
                </Box>
            </div>
        </div>
    )
}
