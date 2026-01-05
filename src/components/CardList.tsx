import { Card } from "./Card";
import { Pagination, Button } from "@heroui/react";
import { textStyles } from "../theme/classNames";
import { useState, useMemo, useRef } from "react";
import { usePrintAndCutStore } from "../stores/printAndCutStore";
import { ImageIcon, ChevronLeft, ChevronRight, Ban, Check } from "lucide-react";
import { Box } from "./Box";
import { motion, AnimatePresence } from "framer-motion";

// @TODO dynamic somehow
const CARDS_PER_PAGE = 8;

// The main goal here is to display a whole page of cards, without compromising card aspect ratio

export function CardList() {

    const [currentPage, setCurrentPage] = useState(1);
    const [direction, setDirection] = useState(0); // -1 for left, 1 for right
    const isScrolling = useRef(false);

    const cardMap = usePrintAndCutStore((state) => state.cardMap);
    const cardOrder = usePrintAndCutStore((state) => state.cardOrder);
    const cardWidth = usePrintAndCutStore((state) => state.cardWidth);
    const cardHeight = usePrintAndCutStore((state) => state.cardHeight);
    const skipSlots = usePrintAndCutStore((state) => state.skipSlots);
    const toggleSkipSlot = usePrintAndCutStore((state) => state.toggleSkipSlot);

    // Calculate total pages accounting for skipped slots
    const availableSlotsPerPage = CARDS_PER_PAGE - skipSlots.size;
    const totalPages = availableSlotsPerPage > 0
        ? Math.ceil(cardOrder.length / availableSlotsPerPage)
        : 0;

    const handleWheel = (e: React.WheelEvent) => {
        const delta = e.deltaY;

        // Threshold to prevent accidental scrolls
        if (Math.abs(delta) < 10) return;

        if (delta > 0 && currentPage < totalPages) {
            // Scroll down - next page
            setDirection(1);
            setCurrentPage(p => Math.min(totalPages, p + 1));
            isScrolling.current = true;
            setTimeout(() => { isScrolling.current = false; }, 100);
        } else if (delta < 0 && currentPage > 1) {
            // Scroll up - previous page
            setDirection(-1);
            setCurrentPage(p => Math.max(1, p - 1));
            isScrolling.current = true;
            setTimeout(() => { isScrolling.current = false; }, 100);
        }
    };

    // Create page layout accounting for skipped slots
    const currentPageCards = useMemo(() => {
        const skipSlotsArray = Array.from(skipSlots).sort((a, b) => a - b);
        const availableSlots = CARDS_PER_PAGE - skipSlotsArray.length;

        // Calculate which cards should be on this page
        const startCardIndex = (currentPage - 1) * availableSlots;
        const endCardIndex = startCardIndex + availableSlots;
        const cardsForPage = cardOrder.slice(startCardIndex, endCardIndex);

        // Build the layout array - use special marker for skipped vs empty
        const layout: (string | null | 'SKIPPED')[] = new Array(CARDS_PER_PAGE).fill(null);
        let cardIdx = 0;

        for (let slotIdx = 0; slotIdx < CARDS_PER_PAGE; slotIdx++) {
            if (skipSlotsArray.includes(slotIdx)) {
                layout[slotIdx] = 'SKIPPED'; // Mark as explicitly skipped
            } else if (cardIdx < cardsForPage.length) {
                layout[slotIdx] = cardsForPage[cardIdx];
                cardIdx++;
            }
            // else remains null (empty slot)
        }

        return layout;
    }, [cardOrder, currentPage, skipSlots]);

    // Go back a page if required
    if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(totalPages);
    }

    // The grid will be a rectangle with LxW ratio of:
    const aspectRatio = (4 * cardWidth) / (2 * cardHeight);

    return (
        <div className="flex h-auto">
            <div className="flex-1 flex items-center justify-center gap-4">
                <Box className="h-full flex flex-col justify-between">
                    <div className="flex-1 flex items-center justify-center ">
                        <Button
                            isIconOnly
                            variant="light"
                            onPress={() => {
                                setDirection(-1);
                                setCurrentPage(p => Math.max(1, p - 1));
                            }}
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
                                overflow: 'hidden',
                            }}
                            onWheel={handleWheel}>
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
                                        width: `min((90vw - 6rem), calc((100vh - 12rem) * ${aspectRatio}))`,
                                        height: `calc(min(90vw - 6rem, calc((100vh - 12rem) * ${aspectRatio})) / ${aspectRatio})`,
                                    }}>
                                    <ImageIcon className="w-24 h-24 mb-4 opacity-30" />
                                    <p className="text-lg">No cards yet</p>
                                    <p className="text-sm mt-1">Upload images to get started</p>
                                </div>) : (
                                <div style={{
                                    position: 'relative',
                                    width: `min(90vw, calc((100vh - 12rem) * ${aspectRatio}))`,
                                    height: `calc(min(90vw, calc((100vh - 12rem) * ${aspectRatio})) / ${aspectRatio})`,
                                }}>
                                    <AnimatePresence initial={false} custom={direction}>
                                        <motion.div
                                            key={currentPage}
                                            custom={direction}
                                            variants={{
                                                enter: (direction: number) => ({
                                                    x: direction > 0 ? '100%' : '-100%',
                                                }),
                                                center: {
                                                    x: 0,
                                                },
                                                exit: (direction: number) => ({
                                                    x: direction > 0 ? '-100%' : '100%',
                                                })
                                            }}
                                            initial="enter"
                                            animate="center"
                                            exit="exit"
                                            transition={{
                                                x: { type: "tween", duration: 0.2, ease: [0.4, 0, 0.2, 1] },
                                            }}
                                            className="grid grid-cols-4 grid-rows-2 gap-2"
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                            }}
                                        >
                                            {currentPageCards.map((cardId, slotIndex) => {
                                                // Calculate global card index based on actual cards before this page
                                                const skipSlotsArray = Array.from(skipSlots).sort((a, b) => a - b);
                                                const availableSlots = CARDS_PER_PAGE - skipSlotsArray.length;
                                                const cardsBeforePage = (currentPage - 1) * availableSlots;

                                                // Count cards in current slots up to this point
                                                let cardsInCurrentSlots = 0;
                                                for (let i = 0; i < slotIndex; i++) {
                                                    if (currentPageCards[i] !== null && currentPageCards[i] !== 'SKIPPED') {
                                                        cardsInCurrentSlots++;
                                                    }
                                                }
                                                const globalIndex = cardsBeforePage + cardsInCurrentSlots;

                                                // Explicitly skipped slot
                                                if (cardId === 'SKIPPED') {
                                                    return (
                                                        <div
                                                            key={`skip-${slotIndex}`}
                                                            className="relative bg-white rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center"
                                                            style={{
                                                                aspectRatio: `${cardWidth} / ${cardHeight}`,
                                                            }}
                                                        >
                                                            <div className="flex flex-col items-center gap-2 text-gray-400">
                                                                <Ban className="w-8 h-8" />
                                                                <span className="text-xs font-medium">Skipped</span>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                // Empty slot (no card assigned)
                                                if (cardId === null) {
                                                    return (
                                                        <div
                                                            key={`empty-${slotIndex}`}
                                                            className="relative bg-transparent"
                                                            style={{
                                                                aspectRatio: `${cardWidth} / ${cardHeight}`,
                                                            }}
                                                        />
                                                    );
                                                }

                                                // Card slot
                                                return (
                                                    <Card
                                                        key={`${cardId}-${globalIndex}`}
                                                        card={cardMap.get(cardId)}
                                                        cardIndex={globalIndex}
                                                        gridPosition={slotIndex}
                                                    />
                                                );
                                            })}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                                )}
                            </div>
                        </div>
                        <Button
                            isIconOnly
                            variant="light"
                            onPress={() => {
                                setDirection(1);
                                setCurrentPage(p => Math.min(totalPages, p + 1));
                            }}
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
                                onChange={(page) => {
                                    setDirection(page > currentPage ? 1 : -1);
                                    setCurrentPage(page);
                                }}
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
