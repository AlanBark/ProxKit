import type { CardImage, PageSettings } from "../../types/card";
import {
    calculateGridLayout,
    calculateAllCardRectangles,
    CARDS_PER_PAGE,
    GRID_COLS,
    GRID_ROWS,
    NO_GRID_OFFSET,
    type CardRectangle,
    type GridOffset,
} from "./cardLayoutUtils";
import { jigHoleLayout } from "./jigHoles";

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
 * Moves a rectangle from the layout's top-down y to DXF's.
 *
 * The layout, like the PDF, measures y down from the top of the sheet; DXF
 * measures it up from the bottom. Every shape cut here is symmetric top to
 * bottom, so only positions flip, never the shapes. Before the grid could move
 * off centre this made no difference - a centred grid reads the same either
 * way up - but a shifted one written top-down would cut upside down, missing
 * the cards by twice the shift.
 */
function toDxfRectangle(rect: CardRectangle, sheetHeight: number): CardRectangle {
    return { ...rect, y: sheetHeight - rect.y - rect.height };
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
        return generateDxfRectangle(toDxfRectangle(rectangle, pageSettings.width), "CUT_LINES", cornerRadius);
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
 * @param cardSpacing Distance between neighbouring cut lines in mm, already clamped
 * @param skipSlots Array of slot indices to skip (0-7)
 * @param cornerRadius Corner radius in mm (default: MTG_CORNER_RADIUS)
 * @param gridOffset How far the grid sits from the centre of the sheet in mm (default: none)
 * @param jigHoles Also cut the pressing jig's holes (default: false)
 * @returns DXF file content as string
 */
export function generateDxfForAllPages(
    allCards: (CardImage | null)[],
    pageSettings: PageSettings,
    cardWidth: number,
    cardHeight: number,
    cardSpacing: number,
    skipSlots: number[] = [],
    cornerRadius: number = MTG_CORNER_RADIUS,
    gridOffset: GridOffset = NO_GRID_OFFSET,
    jigHoles: boolean = false
): string {
    // Same cells as the PDF - the card plus the spacing to its neighbour - so
    // the cut lines land on the printed cards' edges.
    const gridLayout = calculateGridLayout(
        pageSettings.height,
        pageSettings.width,
        cardWidth + cardSpacing,
        cardHeight + cardSpacing,
        0,
        gridOffset
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
        return generateDxfRectangle(toDxfRectangle(rectangle, pageSettings.width), "CUT_LINES", cornerRadius);
    });

    // Assemble complete DXF file with page boundary first
    const entities = [
        pageBoundaryEntity,
        ...cardEntities,
        ...(jigHoles ? generateJigHoleEntities(pageSettings) : []),
    ].join('\n');

    const result = `${DXF_HEADER}\n${entities}\n${DXF_FOOTER}`;

    return result;
}

/**
 * Generate a single straight cut as a DXF LINE entity
 */
function generateDxfLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    layerName: string = "CUT_LINES"
): string {
    return `0
LINE
8
${layerName}
10
${x1.toFixed(3)}
20
${y1.toFixed(3)}
11
${x2.toFixed(3)}
21
${y2.toFixed(3)}`;
}

/**
 * Generate DXF content that cuts down the middle of every gap, out to the page
 * edges, for Maximise Cut Space
 *
 * One line per gap instead of an outline per card: a full-height cut between
 * each pair of columns and a full-width cut between the rows. Each card comes
 * out on the largest piece it can - half the gap on its inner edges, the page
 * margin on its outer ones - not trimmed to card size.
 *
 * @param pageSettings Page configuration
 * @param cardWidth Base card width (without bleed) in mm
 * @param cardHeight Base card height (without bleed) in mm
 * @param cardSpacing Distance between neighbouring cards in mm, already clamped
 * @param gridOffset How far the grid sits from the centre of the sheet in mm (default: none)
 * @param jigHoles Also cut the pressing jig's holes (default: false)
 * @returns DXF file content as string
 */
export function generateCentreLineDxf(
    pageSettings: PageSettings,
    cardWidth: number,
    cardHeight: number,
    cardSpacing: number,
    gridOffset: GridOffset = NO_GRID_OFFSET,
    jigHoles: boolean = false
): string {
    // Landscape, as everywhere else
    const sheetWidth = pageSettings.height;
    const sheetHeight = pageSettings.width;

    // Same cells as the PDF. Each card is centred in its cell, so the boundary
    // between two cells is the middle of the gap between their cards.
    const gridLayout = calculateGridLayout(
        sheetWidth,
        sheetHeight,
        cardWidth + cardSpacing,
        cardHeight + cardSpacing,
        0,
        gridOffset
    );

    const cuts: string[] = [];
    for (let col = 1; col < GRID_COLS; col++) {
        const x = gridLayout.x + col * gridLayout.cellWidth;
        cuts.push(generateDxfLine(x, 0, x, sheetHeight));
    }
    for (let row = 1; row < GRID_ROWS; row++) {
        // Up from the bottom, as DXF measures it - see toDxfRectangle
        const y = sheetHeight - (gridLayout.y + row * gridLayout.cellHeight);
        cuts.push(generateDxfLine(0, y, sheetWidth, y));
    }

    const pageBoundary: CardRectangle = { x: 0, y: 0, width: sheetWidth, height: sheetHeight };
    const pageBoundaryEntity = generateDxfRectangle(pageBoundary, "PAGE_BOUNDARY", 0);

    if (jigHoles) cuts.push(...generateJigHoleEntities(pageSettings));

    return `${DXF_HEADER}\n${pageBoundaryEntity}\n${cuts.join('\n')}\n${DXF_FOOTER}`;
}

/**
 * Generate an arc as a DXF ARC entity. Angles are in degrees, counter-clockwise
 * from east.
 */
function generateDxfArc(
    cx: number,
    cy: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    layerName: string = "CUT_LINES"
): string {
    return `0
ARC
8
${layerName}
10
${cx.toFixed(3)}
20
${cy.toFixed(3)}
40
${radius.toFixed(3)}
50
${startAngle}
51
${endAngle}`;
}

/**
 * The pressing jig's holes, one round hole and one slot, as DXF entities to
 * add to a cut file.
 *
 * They go in the same file as the cards. The holes have to be cut first, on
 * both sheets, so they can be pressed together on the jig before the cards are
 * cut - Silhouette Studio can split them off for that.
 *
 * Circles are drawn as two half arcs rather than a CIRCLE entity: arcs are
 * what the card outlines already use, so they are known to import.
 *
 * @param pageSettings Page configuration
 * @returns DXF entities, one per string
 */
function generateJigHoleEntities(pageSettings: Pick<PageSettings, "width" | "height">): string[] {
    const layout = jigHoleLayout(pageSettings);
    // Up from the bottom, as DXF measures it - see toDxfRectangle. Both holes
    // are symmetric top to bottom, so only their centres move.
    const round = { ...layout.round, y: pageSettings.width - layout.round.y };
    const slot = { ...layout.slot, y: pageSettings.width - layout.slot.y };
    const radius = layout.diameter / 2;
    const slotRadius = slot.width / 2;
    // From the slot's centre to the centre of each rounded end
    const reach = (slot.length - slot.width) / 2;

    return [
        generateDxfArc(round.x, round.y, radius, 0, 180),
        generateDxfArc(round.x, round.y, radius, 180, 360),

        generateDxfArc(slot.x, slot.y + reach, slotRadius, 0, 180),
        generateDxfLine(slot.x - slotRadius, slot.y + reach, slot.x - slotRadius, slot.y - reach),
        generateDxfArc(slot.x, slot.y - reach, slotRadius, 180, 360),
        generateDxfLine(slot.x + slotRadius, slot.y - reach, slot.x + slotRadius, slot.y + reach),
    ];
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
