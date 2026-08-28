// Standard Magic card dimensions in millimeters
export const CARD_DIMENSIONS = {
    width: 63,  // 63mm
    height: 88, // 88mm
    // Standard bleed for MPC fills
    standardBleed: 3, // 3mm standard for MPCFill
    outputBleed: 0.5
} as const;

/**
 * Where an image's bytes actually live.
 *
 * This distinction used to be implicit in a bare `string`, which meant every
 * consumer had to guess whether it held a blob URL or a filesystem path - and
 * they guessed differently. Switch on `kind` instead; see utils/imageSource.ts
 * for the accessors.
 */
export type ImageSource =
    /** An object URL owned by the app. Must be revoked when discarded. */
    | { kind: "blob"; url: string }
    /** A file on disk. Desktop only; readable by the Rust backend. */
    | { kind: "path"; path: string };

export interface CardImage {
    id: string;
    /** Front image. Undefined while a placeholder card is still downloading. */
    image?: ImageSource;
    /** Display thumbnail. Always a blob URL - it is canvas output. */
    thumbnailUrl?: string;
    /** Whether the front thumbnail is being generated */
    thumbnailLoading?: boolean;
    name?: string;
    bleed: number; // bleed amount in millimetres for front image
    /**
     * Marks `bleed` as user-overridden so it is not re-synced when the default
     * changes. It does NOT gate whether bleed applies - `bleed` is always the
     * effective value.
     */
    useCustomBleed: boolean;
    /** Back image specific to this card, overriding the default back. */
    cardBack?: ImageSource;
    /** Display thumbnail for the back. Always a blob URL. */
    cardBackThumbnailUrl?: string;
    /** Whether the back thumbnail is being generated */
    cardBackThumbnailLoading?: boolean;
    cardBackBleed: number; // bleed amount in millimetres for back image
    /** As `useCustomBleed`, but for the back image. */
    useCustomCardBackBleed: boolean;
}

export interface PageSettings {
    width: number;  // page width in millimeters
    height: number; // page height in millimeters
    margin: number; // page margin in millimeters
}

// Common page presets (to be implemented later)
export const PAGE_PRESETS = {
    A4: { width: 210, height: 297, margin: 10 },
    Letter: { width: 215.9, height: 279.4, margin: 10 },
} as const;
