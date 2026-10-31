import { useMemo } from "react";
import { useProjectSettingsStore, selectedPageOption } from "../stores/projectSettingsStore";
import { useCardSpacing } from "./useCardSpacing";
import { NO_GRID_OFFSET, type GridOffset } from "../utils/pdf/cardLayoutUtils";
import { jigGridOffset } from "../utils/pdf/jigHoles";

/**
 * How far the card grid sits from the centre of the sheet, for the PDF and
 * the cut file alike so the cuts stay on the cards.
 *
 * Only the jig holes move it: they take the left margin, so the grid shifts
 * right to give them room. Memoised so it can sit in effect dependencies.
 */
export function useGridOffset(): GridOffset {
    const enableJigHoles = useProjectSettingsStore((state) => state.enableJigHoles);
    const pageSize = useProjectSettingsStore((state) => state.pageSize);
    const cardWidth = useProjectSettingsStore((state) => state.cardWidth);
    const cardHeight = useProjectSettingsStore((state) => state.cardHeight);
    const outputBleed = useProjectSettingsStore((state) => state.outputBleed);
    const cardSpacing = useCardSpacing().effective;

    const page = selectedPageOption(pageSize);

    return useMemo(
        () => enableJigHoles
            ? jigGridOffset(page, cardWidth, cardHeight, outputBleed, cardSpacing)
            : NO_GRID_OFFSET,
        [enableJigHoles, page, cardWidth, cardHeight, outputBleed, cardSpacing]
    );
}
