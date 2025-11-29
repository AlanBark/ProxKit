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

        // Parse details
        const details = parseOrderDetails(xmlDoc, errors);

        // Parse front cards
        const fronts = parseFrontCards(xmlDoc, errors);

        // Parse card back
        const cardback = parseCardBack(xmlDoc, errors);

        return {
            order: {
                details,
                fronts,
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

function parseOrderDetails(xmlDoc: Document, errors: string[]) {
    const detailsElement = xmlDoc.querySelector('details');

    if (!detailsElement) {
        errors.push('Missing <details> element in XML');
        return {
            quantity: 0,
            bracket: 0,
            stock: '',
            foil: false
        };
    }

    const quantity = parseInt(detailsElement.querySelector('quantity')?.textContent || '0', 10);
    const bracket = parseInt(detailsElement.querySelector('bracket')?.textContent || '0', 10);
    const stock = detailsElement.querySelector('stock')?.textContent || '';
    const foil = detailsElement.querySelector('foil')?.textContent?.toLowerCase() === 'true';

    return { quantity, bracket, stock, foil };
}

function parseFrontCards(xmlDoc: Document, errors: string[]): MPCFillCard[] {
    const frontsElement = xmlDoc.querySelector('fronts');

    if (!frontsElement) {
        errors.push('Missing <fronts> element in XML');
        return [];
    }

    const cardElements = frontsElement.querySelectorAll('card');
    const cards: MPCFillCard[] = [];

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

        const slots = parseInt(slotsText || '0', 10);

        cards.push({
            id,
            slots,
            name: name || `Card ${index + 1}`,
            query
        });
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
        details: {
            quantity: 0,
            bracket: 0,
            stock: '',
            foil: false
        },
        fronts: [],
        cardback: null
    };
}
