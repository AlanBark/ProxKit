import { useProjectSettingsStore, selectedPageOption } from "../stores/projectSettingsStore";
import { useCardSpacing } from "./useCardSpacing";
import { jigHolesFit } from "../utils/pdf/jigHoles";

/**
 * The pressing jig's holes: whether they are switched on, whether they clear
 * the current layout, and so whether the cut file gets them.
 *
 * Holes that would run into the cards are left out of the cut file rather
 * than cut through them; the settings say why.
 */
export function useJigHoles() {
    const enabled = useProjectSettingsStore((state) => state.enableJigHoles);
    const pageSize = useProjectSettingsStore((state) => state.pageSize);
    const cardWidth = useProjectSettingsStore((state) => state.cardWidth);
    const cardHeight = useProjectSettingsStore((state) => state.cardHeight);
    const outputBleed = useProjectSettingsStore((state) => state.outputBleed);
    const cardSpacing = useCardSpacing().effective;

    const page = selectedPageOption(pageSize);
    const fits = jigHolesFit(page, cardWidth, cardHeight, outputBleed, cardSpacing);

    return { enabled, fits, cutHoles: enabled && fits, pageLabel: page.label };
}
