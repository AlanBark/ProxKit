import type { Selection } from "@heroui/react";
import { CARD_DIMENSIONS } from "../types/card";
import type { PresetValues } from "./projectSettingsStore";

/**
 * A named card format.
 *
 * Presets cover the physical shape of the job - page, card size and bleeds -
 * so that switching between, say, Magic on A4 and something else is one choice
 * rather than six. Everything else about a job stays where it was.
 */
export interface Preset extends PresetValues {
    id: string;
    label: string;
    /** Shown under the name to explain what the format is. */
    description: string;
}

export const BUILT_IN_PRESETS: readonly Preset[] = [
    {
        id: "mtg-a4",
        label: "Magic: The Gathering (A4)",
        description: `${CARD_DIMENSIONS.width} x ${CARD_DIMENSIONS.height}mm, 8 per page`,
        pageSize: "A4",
        cardWidth: CARD_DIMENSIONS.width,
        cardHeight: CARD_DIMENSIONS.height,
        defaultBleed: CARD_DIMENSIONS.standardBleed,
        defaultCardBackBleed: CARD_DIMENSIONS.standardBleed,
        outputBleed: CARD_DIMENSIONS.outputBleed,
    },
] as const;

/** The page-size key currently selected, or null if the selection is unusable. */
function selectedPageSize(pageSize: Selection): string | null {
    if (pageSize === "all") return null;
    const [key] = pageSize;
    return typeof key === "string" ? key : null;
}

/**
 * The preset matching the current settings, if any.
 *
 * Derived by comparison rather than stored, so the dropdown cannot claim a
 * preset is active after its values have been edited away.
 */
export function matchPreset(
    current: Omit<PresetValues, "pageSize"> & { pageSize: Selection },
    presets: readonly Preset[] = BUILT_IN_PRESETS
): Preset | null {
    const pageSize = selectedPageSize(current.pageSize);
    if (pageSize === null) return null;

    return (
        presets.find(
            (preset) =>
                preset.pageSize === pageSize &&
                preset.cardWidth === current.cardWidth &&
                preset.cardHeight === current.cardHeight &&
                preset.defaultBleed === current.defaultBleed &&
                preset.defaultCardBackBleed === current.defaultCardBackBleed &&
                preset.outputBleed === current.outputBleed
        ) ?? null
    );
}
