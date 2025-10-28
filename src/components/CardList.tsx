import { Card } from "./Card";
import type { CardImage } from "../types/card";

interface CardListProps {
    cards: CardImage[];
    onRemoveCard: (cardId: string) => void;
    onUpdateBleed: (cardId: string, bleed: number) => void;
    onDuplicateCard: (card: CardImage) => void;
}

export function CardList({ cards, onRemoveCard, onUpdateBleed, onDuplicateCard }: CardListProps) {
    return (
        <div className="grid grid-cols-4 grid-rows-2">
            {cards.map((card) => (
                <Card
                    key={card.id}
                    card={card}
                    onRemoveCard={onRemoveCard}
                    onUpdateBleed={onUpdateBleed}
                    onDuplicateCard={onDuplicateCard}
                />
            ))}
        </div>
    );
}
