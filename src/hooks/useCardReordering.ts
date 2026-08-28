import { useEffect } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { useCardStore } from "../stores/cardStore";
import { groupCardsByBacks } from "../utils/cardOperations";

/**
 * Watches for groupByCardBacks changes and automatically reorders cards
 */
export function useCardReordering() {
    const cardMap = useCardStore((state) => state.cardMap);
    const cardOrder = useCardStore((state) => state.cardOrder);
    const setCardOrder = useCardStore((state) => state.setCardOrder);
    const groupByCardBacks = useSettingsStore((state) => state.groupByCardBacks);

    useEffect(() => {
        if (!groupByCardBacks || cardOrder.length === 0) return;

        const reorderedCards = groupCardsByBacks(cardMap, cardOrder);

        const orderChanged = reorderedCards.some((id, index) => id !== cardOrder[index]);
        if (orderChanged) {
            setCardOrder(reorderedCards);
        }
    }, [groupByCardBacks, cardMap, cardOrder, setCardOrder]);
}
