import { useEffect } from "react";
import { usePrintAndCutStore } from "../stores/printAndCutStore";
import { groupCardsByBacks } from "../utils/cardOperations";

/**
 * Watches for groupByCardBacks changes and automatically reorders cards
 */
export function useCardReordering() {
    const cardMap = usePrintAndCutStore((state) => state.cardMap);
    const cardOrder = usePrintAndCutStore((state) => state.cardOrder);
    const setCardOrder = usePrintAndCutStore((state) => state.setCardOrder);
    const groupByCardBacks = usePrintAndCutStore((state) => state.groupByCardBacks);

    useEffect(() => {
        if (!groupByCardBacks || cardOrder.length === 0) return;

        const reorderedCards = groupCardsByBacks(cardMap, cardOrder);

        const orderChanged = reorderedCards.some((id, index) => id !== cardOrder[index]);
        if (orderChanged) {
            setCardOrder(reorderedCards);
        }
    }, [groupByCardBacks, cardMap, cardOrder, setCardOrder]);
}
