export interface MPCFillCard {
    id: string;
    name: string;
    query?: string;
    backId?: string; // Optional unique back for this card
    /** Every position in the order this card fills, ascending - one per copy. */
    slots: number[];
}

export interface MPCFillOrder {
    cards: MPCFillCard[];
    cardback: string | null;
}

export interface MPCFillParseResult {
    order: MPCFillOrder;
    errors: string[];
}
