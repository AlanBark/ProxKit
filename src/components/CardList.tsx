import { Card } from "./Card";
import { Pagination } from "@heroui/react";
import { textStyles } from "../theme/classNames";
import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { ImageIcon } from "lucide-react";
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
        <>
            {cardOrder.length === 0 || !cardOrder ? (
                <Box className="m-6">
                    <div className={`flex flex-col items-center justify-center h-full ${textStyles.muted}`}>
                        <ImageIcon className="w-24 h-24 mb-4 opacity-30" />
                        <p className="text-lg">No cards yet</p>
                        <p className="text-sm mt-1">Upload images to get started</p>
                    </div>
                </Box>
            ) : (
                <div className="flex flex-col h-full">
                    {/* Grid container - centers the grid */}
                    {/* <div className="p-6 flex-1 flex items-center justify-center overflow-hidden"> */}
                        <Box className="m-6 flex-1 flex items-center justify-center overflow-hidden">
                            <div
                                className="w-full h-full"
                                style={{
                                    maxWidth: `min(90vw, calc(100vh - 8rem) * ${(4 * cardWidth + 6) / (2 * cardHeight + 1)})`,
                                    maxHeight: `min(calc(100vh - 8rem), 90vw * ${(2 * cardHeight + 1) / (4 * cardWidth + 3)})`,
                                    minWidth: `min(20vw, calc(100vh - 8rem) * ${(4 * cardWidth + 6) / (2 * cardHeight + 1)})`,
                                    minHeight: `min(calc(20vh - 8rem), 90vw * ${(2 * cardHeight + 1) / (4 * cardWidth + 3)})`,
                            }}>
                                <div className="grid grid-cols-4 grid-rows-2 gap-4">
                                    {currentPageCards.map((cardId, index) => (
                                        <Card
                                            card={cardMap.get(cardId)}
                                            cardIndex={(currentPage - 1) * CARDS_PER_PAGE + index}
                                            gridPosition={index}
                                            key={index}
                                        />
                                    ))}
                                </div>
                            </div>
                        </Box>
                    {/* </div> */}

                    {/* Pagination stays at bottom */}
                    {/* <div className="flex justify-center py-2 shrink-0">
                        <Pagination
                            total={totalPages}
                            page={currentPage}
                            onChange={setCurrentPage}
                            showControls
                            size="sm"
                        />
                    </div> */}
                </div>
            )}
        </>
    );
}
