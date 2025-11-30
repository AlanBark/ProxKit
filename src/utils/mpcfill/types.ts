export interface MPCFillCard {
    id: string;
    slots: number;
    name: string;
    query?: string;
}

export interface MPCFillOrder {
    details: {
        quantity: number;
        bracket: number;
        stock: string;
        foil: boolean;
    };
    fronts: MPCFillCard[];
    cardback: string | null;
}

export interface MPCFillParseResult {
    order: MPCFillOrder;
    errors: string[];
}
