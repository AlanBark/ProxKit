import { useState } from 'react';
import { parseMPCFillXML } from '../utils/mpcfill/xmlParser';
import { resolveDriveImages } from '../utils/mpcfill/imageResolver';
import { useAppSettingsStore } from '../stores/appSettingsStore';
import type { ImageSource } from '../types/card';
import type { MPCFillOrder } from '../utils/mpcfill/types';

/** One image in the order that could not be fetched. */
export interface ImportFailure {
    /** The card it belonged to, or null for the order's shared card back. */
    cardIndex: number | null;
    face: 'front' | 'back' | 'cardback';
    cardName: string;
    message: string;
}

/** How many names to list before the message is just noise. */
const MAX_LISTED_FAILURES = 8;

function describeFailures(failures: ImportFailure[], total: number): string {
    // Copies of a card share an image and so fail together; name each once.
    const counts = new Map<string, number>();
    for (const failure of failures) {
        const suffix = failure.face === 'front' ? '' : ` (${failure.face})`;
        const line = `${failure.cardName}${suffix}`;
        counts.set(line, (counts.get(line) ?? 0) + 1);
    }
    const lines = Array.from(counts, ([line, count]) => `  ${line}${count > 1 ? ` x${count}` : ''}`);

    const listed = lines.slice(0, MAX_LISTED_FAILURES);
    if (lines.length > listed.length) {
        listed.push(`  ...and ${lines.length - listed.length} more`);
    }

    return [
        `${failures.length} of ${total} images could not be fetched.`,
        'Those cards were added without artwork - the rest of the order imported normally.',
        ...listed,
        `First error: ${failures[0].message}`,
    ].join('\n');
}

/**
 * Hook for importing card orders from MPCFill XML files.
 */
export function useMPCFillImport() {
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    // Whether `error` describes a failed import or an import that finished with
    // some artwork missing. The two want different colours, not different text.
    const [errorSeverity, setErrorSeverity] = useState<'error' | 'warning'>('error');
    const [lastImportedOrder, setLastImportedOrder] = useState<MPCFillOrder | null>(null);

    const libraryFolder = useAppSettingsStore((state) => state.libraryFolder);

    const handleXMLImport = async (
        file: File,
        onFileDownloaded: (source: ImageSource, index: number) => void,
        onFileBackDownloaded: (source: ImageSource, index: number) => void,
        onDefaultCardBackDownloaded: (source: ImageSource) => void,
        onFileFailed: (failure: ImportFailure) => void
    ) => {
        setIsImporting(true);
        setImportProgress(0);
        setError(null);
        setErrorSeverity('error');

        try {
            const xmlContent = await file.text();
            const parseResult = parseMPCFillXML(xmlContent);

            if (parseResult.errors.length > 0) {
                const criticalErrors = parseResult.errors.filter(
                    err => !err.includes('optional')
                );
                if (criticalErrors.length > 0) {
                    throw new Error(`XML parsing errors:\n${criticalErrors.join('\n')}`);
                }
            }

            const order = parseResult.order;

            if (order.cards.length === 0) {
                throw new Error('No cards found in XML file');
            }

            setLastImportedOrder(order);

            let completedCount = 0;
            // Build array of files to download
            const filesToDownload: { id: string; name: string; cardName: string; type: 'front' | 'back' | 'cardback'; cardIndex?: number }[] = [];

            // Add front cards and their unique backs
            order.cards.forEach((card, index) => {
                filesToDownload.push({
                    id: card.id,
                    name: `${card.name}.jpg`,
                    cardName: card.name,
                    type: 'front',
                    cardIndex: index
                });

                if (card.backId) {
                    filesToDownload.push({
                        id: card.backId,
                        name: `${card.name}_back.jpg`,
                        cardName: card.name,
                        type: 'back',
                        cardIndex: index
                    });
                }
            });

            // Add default cardback if present
            if (order.cardback) {
                filesToDownload.push({
                    id: order.cardback,
                    name: 'cardback.jpg',
                    cardName: 'Shared card back',
                    type: 'cardback'
                });
            }

            // A missing image is per-card, so these are collected and summarised
            // once the order has finished rather than thrown.
            const failures: ImportFailure[] = [];
            const countProgress = () => {
                completedCount++;
                setImportProgress(Math.round((completedCount / filesToDownload.length) * 100));
            };

            // Resolved from the image library where one is set, downloaded otherwise
            await resolveDriveImages(
                filesToDownload.map(f => ({ id: f.id, name: f.name })),
                libraryFolder,
                (source: ImageSource, _id: string, index: number) => {
                    countProgress();

                    // Call appropriate callback based on file type
                    const fileInfo = filesToDownload[index];

                    if (fileInfo.type === 'cardback') {
                        onDefaultCardBackDownloaded(source);
                    } else if (fileInfo.type === 'front') {
                        onFileDownloaded(source, fileInfo.cardIndex!);
                    } else if (fileInfo.type === 'back') {
                        onFileBackDownloaded(source, fileInfo.cardIndex!);
                    }
                },
                (err: unknown, _id: string, index: number) => {
                    countProgress();

                    const fileInfo = filesToDownload[index];
                    const failure: ImportFailure = {
                        cardIndex: fileInfo.cardIndex ?? null,
                        face: fileInfo.type,
                        cardName: fileInfo.cardName,
                        message: err instanceof Error ? err.message : String(err),
                    };
                    failures.push(failure);
                    console.warn(`Could not fetch the ${failure.face} image for ${failure.cardName}:`, err);

                    // Lets the card stop showing a spinner for artwork that is
                    // never going to arrive.
                    onFileFailed(failure);
                }
            );

            setIsImporting(false);
            setImportProgress(100);

            if (failures.length > 0) {
                setErrorSeverity('warning');
                setError(describeFailures(failures, filesToDownload.length));
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
            setIsImporting(false);
            setImportProgress(0);
            console.error('MPCFill import error:', err);
        }
    };

    const clearError = () => {
        setError(null);
    };

    return {
        isImporting,
        importProgress,
        error,
        errorSeverity,
        lastImportedOrder,
        handleXMLImport,
        clearError
    };
}
