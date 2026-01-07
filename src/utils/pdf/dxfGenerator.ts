import type { CardImage, PageSettings } from "../../types/card";
import {
    calculateGridLayout,
    calculateAllCardRectangles,
    CARDS_PER_PAGE,
    type CardRectangle,
} from "./cardLayoutUtils";

/**
 * DXF Generator - Creates DXF cut files for cutting machines
 *
 * DXF (Drawing Exchange Format) is a CAD data file format used by Silhouette Studio
 * and other cutting software to define cut paths.
 */

/**
 * MTG standard corner radius in millimeters
 * Magic: The Gathering cards have a corner radius of approximately 2.5mm
 */
export const MTG_CORNER_RADIUS = 2.5;

/**
 * DXF file structure constants
 */
const DXF_HEADER = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1015
9
$INSUNITS
70
4
0
ENDSEC
0
SECTION
2
ENTITIES`;

const DXF_FOOTER = `0
ENDSEC
0
EOF`;

/**
 * Generate a DXF rectangle entity with optional rounded corners
 * Uses separate LINE and ARC entities for precise control
 *
 * @param rect Card rectangle with position and dimensions
 * @param layerName Layer name for organization (e.g., "CUT_LINES")
 * @param cornerRadius Corner radius in mm (default: 0 for sharp corners)
 * @returns DXF entity string
 */
function generateDxfRectangle(
    rect: CardRectangle,
    layerName: string = "CUT_LINES",
    cornerRadius: number = 0
): string {
    const x1 = rect.x;
    const y1 = rect.y;
    const x2 = rect.x + rect.width;
    const y2 = rect.y + rect.height;

    // If no corner radius, generate a simple rectangle
    if (cornerRadius <= 0) {
        return `0
LWPOLYLINE
8
${layerName}
90
4
70
1
10
${x1.toFixed(3)}
20
${y1.toFixed(3)}
10
${x2.toFixed(3)}
20
${y1.toFixed(3)}
10
${x2.toFixed(3)}
20
${y2.toFixed(3)}
10
${x1.toFixed(3)}
20
${y2.toFixed(3)}`;
    }

    // For rounded corners, use LINE and ARC entities
    const r = cornerRadius;

    // Calculate edge endpoints (where lines meet arcs)
    // Top edge
    const topLeft = { x: x1 + r, y: y1 };
    const topRight = { x: x2 - r, y: y1 };

    // Right edge
    const rightTop = { x: x2, y: y1 + r };
    const rightBottom = { x: x2, y: y2 - r };

    // Bottom edge
    const bottomRight = { x: x2 - r, y: y2 };
    const bottomLeft = { x: x1 + r, y: y2 };

    // Left edge
    const leftBottom = { x: x1, y: y2 - r };
    const leftTop = { x: x1, y: y1 + r };

    // Arc centers
    const topLeftCenter = { x: x1 + r, y: y1 + r };
    const topRightCenter = { x: x2 - r, y: y1 + r };
    const bottomRightCenter = { x: x2 - r, y: y2 - r };
    const bottomLeftCenter = { x: x1 + r, y: y2 - r };

    // DXF arcs go counter-clockwise from start angle to end angle
    // Angles are in degrees: 0° = right (east), 90° = up (north), 180° = left (west), 270° = down (south)
    // Each arc connects two line segments, curving inward at the corner

    return `0
LINE
8
${layerName}
10
${topLeft.x.toFixed(3)}
20
${topLeft.y.toFixed(3)}
11
${topRight.x.toFixed(3)}
21
${topRight.y.toFixed(3)}
0
ARC
8
${layerName}
10
${topRightCenter.x.toFixed(3)}
20
${topRightCenter.y.toFixed(3)}
40
${r.toFixed(3)}
50
270
51
360
0
LINE
8
${layerName}
10
${rightTop.x.toFixed(3)}
20
${rightTop.y.toFixed(3)}
11
${rightBottom.x.toFixed(3)}
21
${rightBottom.y.toFixed(3)}
0
ARC
8
${layerName}
10
${bottomRightCenter.x.toFixed(3)}
20
${bottomRightCenter.y.toFixed(3)}
40
${r.toFixed(3)}
50
0
51
90
0
LINE
8
${layerName}
10
${bottomRight.x.toFixed(3)}
20
${bottomRight.y.toFixed(3)}
11
${bottomLeft.x.toFixed(3)}
21
${bottomLeft.y.toFixed(3)}
0
ARC
8
${layerName}
10
${bottomLeftCenter.x.toFixed(3)}
20
${bottomLeftCenter.y.toFixed(3)}
40
${r.toFixed(3)}
50
90
51
180
0
LINE
8
${layerName}
10
${leftBottom.x.toFixed(3)}
20
${leftBottom.y.toFixed(3)}
11
${leftTop.x.toFixed(3)}
21
${leftTop.y.toFixed(3)}
0
ARC
8
${layerName}
10
${topLeftCenter.x.toFixed(3)}
20
${topLeftCenter.y.toFixed(3)}
40
${r.toFixed(3)}
50
180
51
270`;
}

/**
 * Generate DXF content for a page of cards
 *
 * @param cards Array of cards (null = blank placeholder)
 * @param pageSettings Page configuration
 * @param cardWidth Base card width (without bleed) in mm
 * @param cardHeight Base card height (without bleed) in mm
 * @param outputBleed Output bleed amount in mm
 * @param skipSlots Array of slot indices to skip (0-7)
 * @param cornerRadius Corner radius in mm (default: MTG_CORNER_RADIUS)
 * @returns DXF file content as string
 */
export function generateDxfForPage(
    cards: (CardImage | null)[],
    pageSettings: PageSettings,
    cardWidth: number,
    cardHeight: number,
    outputBleed: number,
    skipSlots: number[] = [],
    cornerRadius: number = MTG_CORNER_RADIUS
): string {
    // Calculate gap between cards (2x outputBleed for gap on each side)
    const gap = 2 * outputBleed;

    // Calculate grid layout (landscape orientation)
    const gridLayout = calculateGridLayout(
        pageSettings.height,  // Landscape width
        pageSettings.width,   // Landscape height
        cardWidth + (2 * outputBleed),  // Cell width with bleed
        cardHeight + (2 * outputBleed),  // Cell height with bleed
        gap  // Gap between cards
    );

    // Get all card rectangles for this page
    const rectangles = calculateAllCardRectangles(
        cards,
        gridLayout,
        cardWidth,
        cardHeight,
        outputBleed,
        skipSlots
    );

    // Generate page boundary rectangle (landscape orientation)
    const pageBoundary: CardRectangle = {
        x: 0,
        y: 0,
        width: pageSettings.height,  // Landscape width
        height: pageSettings.width   // Landscape height
    };

    // Generate page boundary (no rounded corners, different layer)
    const pageBoundaryEntity = generateDxfRectangle(pageBoundary, "PAGE_BOUNDARY", 0);

    // Generate DXF entities with rounded corners
    const cardEntities = rectangles.map(({ rectangle }) => {
        return generateDxfRectangle(rectangle, "CUT_LINES", cornerRadius);
    }).join('\n');

    // Assemble complete DXF file with page boundary first
    const entities = cardEntities.length > 0
        ? `${pageBoundaryEntity}\n${cardEntities}`
        : pageBoundaryEntity;

    return `${DXF_HEADER}\n${entities}\n${DXF_FOOTER}`;
}

/**
 * Generate DXF content for multiple pages of cards
 * Each page's rectangles are included in a single DXF file
 *
 * @param allCards Array of all cards across all pages
 * @param pageSettings Page configuration
 * @param cardWidth Base card width (without bleed) in mm
 * @param cardHeight Base card height (without bleed) in mm
 * @param outputBleed Output bleed amount in mm
 * @param skipSlots Array of slot indices to skip (0-7)
 * @param cornerRadius Corner radius in mm (default: MTG_CORNER_RADIUS)
 * @returns DXF file content as string
 */
export function generateDxfForAllPages(
    allCards: (CardImage | null)[],
    pageSettings: PageSettings,
    cardWidth: number,
    cardHeight: number,
    outputBleed: number,
    skipSlots: number[] = [],
    cornerRadius: number = MTG_CORNER_RADIUS
): string {
    const gap = 0;

    // Calculate grid layout - cells include the bleed around them
    const gridLayout = calculateGridLayout(
        pageSettings.height,
        pageSettings.width, 
        cardWidth + (2 * outputBleed),
        cardHeight + (2 * outputBleed), 
        gap 
    );

    // Generate page boundary rectangle (landscape orientation)
    const pageBoundary: CardRectangle = {
        x: 0,
        y: 0,
        width: pageSettings.height,
        height: pageSettings.width
    };

    // Generate page boundary (no rounded corners, different layer)
    const pageBoundaryEntity = generateDxfRectangle(pageBoundary, "PAGE_BOUNDARY", 0);

    const pageCards: (CardImage | null)[] = [];
    const firstCard = allCards.find(card => card !== null);

    for (let slot = 0; slot < CARDS_PER_PAGE; slot++) {
        if (skipSlots.includes(slot)) {
            pageCards.push(null);
        } else if (firstCard) {
            pageCards.push(firstCard);
        } else {
            pageCards.push(null);
        }
    }

    const allRectangles = calculateAllCardRectangles(
        pageCards,
        gridLayout,
        cardWidth,
        cardHeight,
        0,
        skipSlots
    );

    // Generate DXF entities for all rectangles with rounded corners
    const cardEntities = allRectangles.map(({ rectangle }) => {
        return generateDxfRectangle(rectangle, "CUT_LINES", cornerRadius);
    }).join('\n');

    // Assemble complete DXF file with page boundary first
    const entities = cardEntities.length > 0
        ? `${pageBoundaryEntity}\n${cardEntities}`
        : pageBoundaryEntity;

    const result = `${DXF_HEADER}\n${entities}\n${DXF_FOOTER}`;

    return result;
}

/**
 * Convert DXF string to Blob for download
 *
 * @param dxfContent DXF file content as string
 * @returns Blob with application/dxf MIME type
 */
export function dxfStringToBlob(dxfContent: string): Blob {
    return new Blob([dxfContent], { type: "application/dxf" });
}

/**
 * Generate DXF and create a downloadable URL
 *
 * @param cards Array of cards
 * @param pageSettings Page configuration
 * @param cardWidth Base card width in mm
 * @param cardHeight Base card height in mm
 * @param outputBleed Output bleed in mm
 * @param skipSlots Slots to skip
 * @param cornerRadius Corner radius in mm (default: MTG_CORNER_RADIUS)
 * @returns Object URL for the generated DXF file
 */
export function generateDxfUrl(
    cards: (CardImage | null)[],
    pageSettings: PageSettings,
    cardWidth: number,
    cardHeight: number,
    outputBleed: number,
    skipSlots: number[] = [],
    cornerRadius: number = MTG_CORNER_RADIUS
): string {
    const dxfContent = generateDxfForAllPages(
        cards,
        pageSettings,
        cardWidth,
        cardHeight,
        outputBleed,
        skipSlots,
        cornerRadius
    );

    const blob = dxfStringToBlob(dxfContent);
    return URL.createObjectURL(blob);
}
