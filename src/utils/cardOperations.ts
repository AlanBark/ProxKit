import type { CardImage } from "../types/card";

/**
 * Removes a card at the specified index
 * Returns updated cardMap and cardOrder
 */
export function removeCard(
    cardIndex: number,
    cardMap: Map<string, CardImage>,
    cardOrder: string[]
): { cardMap: Map<string, CardImage>; cardOrder: string[] } {
    const cardId = cardOrder[cardIndex];
    const cardIdInstances = cardOrder.filter((id) => id === cardId);

    const newCardMap = new Map(cardMap);
    const newCardOrder = [...cardOrder];

    // If this is the last instance of this card, clean up and remove from map
    if (cardIdInstances.length === 1) {
        const card = cardMap.get(cardId);
        if (card) {
            // Cleanup blob URLs
            URL.revokeObjectURL(card.imageUrl);
            if (card.thumbnailUrl) {
                URL.revokeObjectURL(card.thumbnailUrl);
            }
            if (card.cardBackUrl) {
                URL.revokeObjectURL(card.cardBackUrl);
            }
            if (card.cardBackThumbnailUrl) {
                URL.revokeObjectURL(card.cardBackThumbnailUrl);
            }
        }
        newCardMap.delete(cardId);
    }

    // Remove from order
    newCardOrder.splice(cardIndex, 1);

    return { cardMap: newCardMap, cardOrder: newCardOrder };
}

/**
 * Removes all cards and cleans up blob URLs
 */
export function removeAllCards(cardMap: Map<string, CardImage>): void {
    for (const card of cardMap.values()) {
        URL.revokeObjectURL(card.imageUrl);
        if (card.thumbnailUrl) {
            URL.revokeObjectURL(card.thumbnailUrl);
        }
        if (card.cardBackUrl) {
            URL.revokeObjectURL(card.cardBackUrl);
        }
        if (card.cardBackThumbnailUrl) {
            URL.revokeObjectURL(card.cardBackThumbnailUrl);
        }
    }
}

/**
 * Duplicates a card in the order
 * Returns updated cardOrder
 */
export function duplicateCard(
    cardId: string,
    count: number,
    cardOrder: string[],
    insertAtIndex?: number
): string[] {
    const duplicateIds: string[] = new Array(count).fill(cardId);
    const newOrder = [...cardOrder];

    if (insertAtIndex !== undefined && insertAtIndex >= 0 && insertAtIndex <= newOrder.length) {
        newOrder.splice(insertAtIndex, 0, ...duplicateIds);
    } else {
        newOrder.push(...duplicateIds);
    }

    return newOrder;
}

/**
 * Groups cards by whether they have custom backs
 * Returns reordered cardOrder
 */
export function groupCardsByBacks(
    cardMap: Map<string, CardImage>,
    cardOrder: string[]
): string[] {
    return [...cardOrder].sort((aId, bId) => {
        const cardA = cardMap.get(aId);
        const cardB = cardMap.get(bId);

        if (!cardA || !cardB) return 0;

        const aHasCustomBack = cardA.cardBackUrl !== undefined;
        const bHasCustomBack = cardB.cardBackUrl !== undefined;

        if (aHasCustomBack === bHasCustomBack) return 0;

        return aHasCustomBack ? -1 : 1;
    });
}
