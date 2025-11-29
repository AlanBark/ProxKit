// Standard Magic card dimensions in millimeters
export const CARD_DIMENSIONS = {
    width: 63,  // 63mm
    height: 88, // 88mm
    // Standard bleed for MPC fills
    standardBleed: 3, // 3mm standard for MPCFill
    outputBleed: 0.5
} as const;

export interface CardImage {
    id: string;
    imageUrl: string;
    thumbnailUrl?: string; // Lower-res version for UI display
    thumbnailLoading?: boolean; // Whether thumbnail is being generated
    name?: string;
    bleed: number; // bleed amount in millimeters for front image
    useCustomBleed: boolean; // true if user manually set a custom bleed for this card
    cardBackUrl?: string; // Custom back image for this specific card (original blob URL)
    cardBackThumbnailUrl?: string; // Lower-res version of card back for UI display
    cardBackThumbnailLoading?: boolean; // Whether card back thumbnail is being generated
    cardBackBleed: number; // bleed amount in millimeters for back image
    useCustomCardBackBleed: boolean; // true if user manually set a custom back bleed for this card
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
