export interface MPCFillCard {
    id: string;
    name: string;
    query?: string;
    backId?: string; // Optional unique back for this card
}

export interface MPCFillOrder {
    cards: MPCFillCard[];
    cardback: string | null;
}

export interface MPCFillParseResult {
    order: MPCFillOrder;
    errors: string[];
}
