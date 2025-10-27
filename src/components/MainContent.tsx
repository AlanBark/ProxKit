import { Image as ImageIcon } from "lucide-react";
import { CardList } from "./CardList";
import { backgroundStyles, textStyles } from "../theme/classNames";
import { useApp } from "../context/AppContext";

export function MainContent() {
    const { cards, handleRemoveCard, handleUpdateBleed, handleDuplicateCard } = useApp();

    return (
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
            {/* Cards Grid */}
            <div className={`flex-1 ${backgroundStyles.surface} backdrop-blur-sm rounded-2xl border border-(--border) overflow-hidden`}>
                <div className="h-full overflow-auto p-6">
                    {cards.length === 0 ? (
                        <div className={`flex flex-col items-center justify-center h-full ${textStyles.muted}`}>
                            <ImageIcon className="w-24 h-24 mb-4 opacity-30" />
                            <p className="text-lg">No cards yet</p>
                            <p className="text-sm mt-1">Upload images to get started</p>
                        </div>
                    ) : (
                        <CardList
                            cards={cards}
                            onRemoveCard={handleRemoveCard}
                            onUpdateBleed={handleUpdateBleed}
                            onDuplicateCard={handleDuplicateCard}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
