// Standard Magic card dimensions in millimeters
export const CARD_DIMENSIONS = {
    width: 63,  // 63mm
    height: 88, // 88mm
    // Standard bleed for MPC fills
    standardBleed: 3, // 3mm standard for MPCFill
} as const;

export interface CardImage {
    id: string;
    imageUrl: string;
    thumbnailUrl?: string; // Lower-res version for UI display
    thumbnailLoading?: boolean; // Whether thumbnail is being generated
    name?: string;
    bleed: number; // bleed amount in millimeters
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
