import type { MPCFillOrder, MPCFillCard, MPCFillParseResult } from './types';

/**
 * Parses an MPCFill XML file and extracts order information
 */
export function parseMPCFillXML(xmlContent: string): MPCFillParseResult {
    const errors: string[] = [];

    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

        // Check for XML parsing errors
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            errors.push('Invalid XML format: ' + parserError.textContent);
            return {
                order: createEmptyOrder(),
                errors
            };
        }

        // Parse front cards
        const fronts = parseFrontCards(xmlDoc, errors);

        // Parse per-card backs
        const backs = parseBackCards(xmlDoc, errors);

        // Create cards array by combining fronts with their matching backs
        const cards = pairFrontsWithBacks(fronts, backs);

        // Parse default card back
        const cardback = parseCardBack(xmlDoc, errors);

        return {
            order: {
                cards,
                cardback
            },
            errors
        };
    } catch (error) {
        errors.push(`Failed to parse XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return {
            order: createEmptyOrder(),
            errors
        };
    }
}

/**
 * Reads a <slots> value. MPCFill lists every slot a card fills in one
 * comma-separated value, so "0,1,2" is three copies of the same card.
 */
function parseSlots(slotsText: string | undefined): number[] {
    if (!slotsText) return [];
    return slotsText
        .split(',')
        .map(slot => parseInt(slot.trim(), 10))
        .filter(slot => Number.isInteger(slot) && slot >= 0)
        .sort((a, b) => a - b);
}

/**
 * Gives each front the unique back from its slots.
 *
 * Copies of a front normally share a back, so they stay one card filling
 * several slots. A front whose copies were given different backs splits into
 * one card per back, since a card only carries one.
 */
function pairFrontsWithBacks(fronts: MPCFillCard[], backs: Map<number, MPCFillCard>): MPCFillCard[] {
    return fronts.flatMap(front => {
        const slotsByBack = new Map<string | undefined, number[]>();
        for (const slot of front.slots) {
            const backId = backs.get(slot)?.id;
            const slots = slotsByBack.get(backId);
            if (slots) {
                slots.push(slot);
            } else {
                slotsByBack.set(backId, [slot]);
            }
        }
        return Array.from(slotsByBack, ([backId, slots]) => ({ ...front, backId, slots }));
    });
}

function parseFrontCards(xmlDoc: Document, errors: string[]): MPCFillCard[] {

    const cards: MPCFillCard[] = [];
    const frontsElement = xmlDoc.querySelector('fronts');

    if (!frontsElement) {
        errors.push('Missing <fronts> element in XML');
        return cards;
    }

    const cardElements = frontsElement.querySelectorAll('card');

    cardElements.forEach((cardElement, index) => {
        const id = cardElement.querySelector('id')?.textContent?.trim();
        const slotsText = cardElement.querySelector('slots')?.textContent?.trim();
        const name = cardElement.querySelector('name')?.textContent?.trim();
        const query = cardElement.querySelector('query')?.textContent?.trim();

        if (!id) {
            errors.push(`Card at index ${index} is missing an <id> element`);
            return;
        }

        if (!name) {
            errors.push(`Card at index ${index} is missing a <name> element`);
        }

        const slots = parseSlots(slotsText);

        if (slots.length === 0) {
            errors.push(`Card at index ${index} is missing a <slots> element`);
            return;
        }

        cards.push({
            id,
            name: name || `Card ${index + 1}`,
            query,
            slots
        });
    });

    // Download in the order the cards appear, not the order they were listed
    return cards.sort((a, b) => a.slots[0] - b.slots[0]);
}

function parseBackCards(xmlDoc: Document, errors: string[]): Map<number, MPCFillCard> {
    
    const cards = new Map<number, MPCFillCard>();
    const backsElement = xmlDoc.querySelector('backs');

    if (!backsElement) {
        // This is optional - not all cards have unique backs
        return cards;
    }

    const cardElements = backsElement.querySelectorAll('card');

    cardElements.forEach((cardElement, index) => {
        const id = cardElement.querySelector('id')?.textContent?.trim();
        const slotsText = cardElement.querySelector('slots')?.textContent?.trim();
        const name = cardElement.querySelector('name')?.textContent?.trim();
        const query = cardElement.querySelector('query')?.textContent?.trim();

        if (!id) {
            errors.push(`Back card at index ${index} is missing an <id> element`);
            return;
        }

        const slots = parseSlots(slotsText);

        if (slots.length === 0) {
            errors.push(`Back card at index ${index} is missing a <slots> element`);
            return;
        }

        const backCard: MPCFillCard = {
            id,
            name: name || `Card Back ${index + 1}`,
            query,
            slots
        };
        for (const slot of slots) {
            cards.set(slot, backCard);
        }
    });

    return cards;
}

function parseCardBack(xmlDoc: Document, errors: string[]): string | null {
    const cardbackElement = xmlDoc.querySelector('cardback');

    if (!cardbackElement) {
        errors.push('Missing <cardback> element in XML (this is optional)');
        return null;
    }

    const cardbackId = cardbackElement.textContent?.trim();

    if (!cardbackId) {
        return null;
    }

    return cardbackId;
}

function createEmptyOrder(): MPCFillOrder {
    return {
        cards: [],
        cardback: null
    };
}
