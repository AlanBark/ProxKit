import { Trash2, Plus } from "lucide-react";
import type { CardImage } from "../types/card";
import { cardStyles, inputStyles, textStyles } from "../theme/classNames";

interface CardProps {
  card: CardImage;
  onRemoveCard: (cardId: string) => void;
  onUpdateBleed: (cardId: string, bleed: number) => void;
  onDuplicateCard: (card: CardImage) => void;
}

export function Card({ card, onRemoveCard, onUpdateBleed, onDuplicateCard }: CardProps) {
  return (
    <div className={`${cardStyles.interactive} backdrop-blur-sm rounded-xl overflow-hidden transition-all group`}>
      {/* Card Image */}
      <div className={`relative aspect-[63/88] overflow-hidden ${cardStyles.elevated} cursor-pointer`}>
        <img
          src={card.imageUrl}
          alt={card.name || `Card ${card.id}`}
          className="w-full h-full object-cover"
        />

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--overlay-dark)] via-transparent to-[var(--overlay-light)] opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Top overlay - Name (left) and Delete (right) */}
        <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Name */}
          <div className={`text-sm font-medium ${textStyles.primary} drop-shadow-lg flex-1 pr-2 truncate`}>
            {card.name || `Card ${card.id.substring(0, 8)}`}
          </div>

          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemoveCard(card.id);
            }}
            className="bg-[var(--danger)]/20 backdrop-blur-sm rounded-lg p-2 hover:bg-[var(--danger)]/40 transition-colors"
            title="Delete card"
          >
            <Trash2 className="w-5 h-5 text-[var(--danger)]" />
          </button>
        </div>

        {/* Center - Plus icon for duplicate */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDuplicateCard(card);
          }}
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          title="Duplicate card"
        >
          <div className="bg-[var(--primary)] rounded-full p-3 hover:bg-[var(--primary-hover)] transition-colors shadow-xl">
            <Plus className={`w-8 h-8 ${textStyles.primary}`} />
          </div>
        </button>

        {/* Bottom overlay - Bleed input */}
        <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-[var(--overlay-dark)] backdrop-blur-sm rounded-lg p-2">
            <div className="relative">
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={card.bleed}
                onChange={(e) => {
                  e.stopPropagation();
                  onUpdateBleed(card.id, parseFloat(e.target.value) || 0);
                }}
                onClick={(e) => e.stopPropagation()}
                className={`w-full ${inputStyles.default} rounded-lg px-3 py-2 text-sm focus:outline-none pr-16`}
                placeholder="Bleed"
              />
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 ${textStyles.secondary} text-sm pointer-events-none`}>
                mm bleed
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
