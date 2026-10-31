import { useProjectSettingsStore, selectedPageOption } from "../stores/projectSettingsStore";
import { cardSpacingRange, clampCardSpacing } from "../utils/pdf/cardLayoutUtils";

/**
 * The card spacing the output will use, next to the one that was asked for.
 *
 * The stored value is kept as the user set it, because what fits depends on
 * the page and card size, and those can change afterwards. The generators take
 * `effective`; the settings UI shows `requested` and explains any difference.
 * So switching to a smaller page never throws the preference away, and never
 * prints over the registration marks either.
 *
 * Maximise Cut Space ignores the setting: its one cut per gap has no strip
 * between cuts to widen, so cards sit at the minimum, bleeds meeting, and the
 * cut runs exactly where they meet.
 */
export function useCardSpacing() {
    const pageSize = useProjectSettingsStore((state) => state.pageSize);
    const cardWidth = useProjectSettingsStore((state) => state.cardWidth);
    const cardHeight = useProjectSettingsStore((state) => state.cardHeight);
    const outputBleed = useProjectSettingsStore((state) => state.outputBleed);
    const requested = useProjectSettingsStore((state) => state.cardSpacing);
    const maximiseCutSpace = useProjectSettingsStore((state) => state.maximiseCutSpace);

    const page = selectedPageOption(pageSize);
    const range = cardSpacingRange(page, cardWidth, cardHeight, outputBleed);

    return {
        requested,
        effective: maximiseCutSpace ? range.min : clampCardSpacing(requested, range),
        min: range.min,
        max: range.max,
        pageLabel: page.label,
    };
}
