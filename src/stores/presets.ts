import { CARD_DIMENSIONS } from "../types/card";
import type { PresetValues } from "./projectSettingsStore";

/**
 * A named card format.
 *
 * Covers the card itself - size and bleeds - so switching between card games is
 * one choice rather than five. Page size is chosen separately, since the same
 * cards get printed on whatever paper is to hand.
 */
export interface Preset extends PresetValues {
    id: string;
    label: string;
    /** Shown under the name to explain what the format is. */
    description: string;
}

/**
 * The 63 x 88mm card used by Magic, Pokemon, One Piece and Riftbound.
 *
 * These are the same physical card, not merely similar, so they share one
 * preset. Listing them separately would give several names to one format - and
 * because the active preset is matched on values, picking "Pokemon" would
 * immediately read back as whichever identical entry came first.
 */
const TCG_CARD = {
    cardWidth: CARD_DIMENSIONS.width,
    cardHeight: CARD_DIMENSIONS.height,
    defaultBleed: CARD_DIMENSIONS.standardBleed,
    defaultCardBackBleed: CARD_DIMENSIONS.standardBleed,
    outputBleed: CARD_DIMENSIONS.outputBleed,
} as const;

/** Poker-size playing cards: half a millimetre wider and taller than a TCG card. */
const POKER_CARD = {
    cardWidth: 63.5,
    cardHeight: 88.9,
    defaultBleed: CARD_DIMENSIONS.standardBleed,
    defaultCardBackBleed: CARD_DIMENSIONS.standardBleed,
    outputBleed: CARD_DIMENSIONS.outputBleed,
} as const;

export const BUILT_IN_PRESETS: readonly Preset[] = [
    {
        id: "tcg",
        label: "MTG",
        description: "MTG, Pokemon, One Piece, Riftbound - 63 x 88mm",
        ...TCG_CARD,
    },
    {
        id: "poker",
        label: "Playing cards",
        description: "Poker playing cards - 63.5 x 88.9mm",
        ...POKER_CARD,
    },
] as const;

/**
 * The preset matching the current settings, if any.
 *
 * Derived by comparison rather than stored, so the dropdown cannot claim a
 * preset is active after its values have been edited away.
 */
export function matchPreset(
    current: PresetValues,
    presets: readonly Preset[] = BUILT_IN_PRESETS
): Preset | null {
    return (
        presets.find(
            (preset) =>
                preset.cardWidth === current.cardWidth &&
                preset.cardHeight === current.cardHeight &&
                preset.defaultBleed === current.defaultBleed &&
                preset.defaultCardBackBleed === current.defaultCardBackBleed &&
                preset.outputBleed === current.outputBleed
        ) ?? null
    );
}
