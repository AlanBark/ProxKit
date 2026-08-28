import { useState } from 'react';
import { parseMPCFillXML } from '../utils/mpcfill/xmlParser';
import { resolveDriveImages } from '../utils/mpcfill/imageResolver';
import { useAppSettingsStore } from '../stores/appSettingsStore';
import type { ImageSource } from '../types/card';
import type { MPCFillOrder } from '../utils/mpcfill/types';

/**
 * Hook for importing card orders from MPCFill XML files.
 */
export function useMPCFillImport() {
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [lastImportedOrder, setLastImportedOrder] = useState<MPCFillOrder | null>(null);

    const libraryFolder = useAppSettingsStore((state) => state.libraryFolder);

    const handleXMLImport = async (
        file: File,
        onFileDownloaded: (source: ImageSource, index: number) => void,
        onFileBackDownloaded: (source: ImageSource, index: number) => void,
        onDefaultCardBackDownloaded: (source: ImageSource) => void
    ) => {
        setIsImporting(true);
        setImportProgress(0);
        setError(null);

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
            const filesToDownload: { id: string; name: string; type: 'front' | 'back' | 'cardback'; cardIndex?: number }[] = [];

            // Add front cards and their unique backs
            order.cards.forEach((card, index) => {
                filesToDownload.push({
                    id: card.id,
                    name: `${card.name}.jpg`,
                    type: 'front',
                    cardIndex: index
                });

                if (card.backId) {
                    filesToDownload.push({
                        id: card.backId,
                        name: `${card.name}_back.jpg`,
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
                    type: 'cardback'
                });
            }

            // Resolved from the image library where one is set, downloaded otherwise
            await resolveDriveImages(
                filesToDownload.map(f => ({ id: f.id, name: f.name })),
                libraryFolder,
                (source: ImageSource, _id: string, index: number) => {
                    completedCount++;
                    setImportProgress(Math.round((completedCount / filesToDownload.length) * 100));

                    // Call appropriate callback based on file type
                    const fileInfo = filesToDownload[index];

                    if (fileInfo.type === 'cardback') {
                        onDefaultCardBackDownloaded(source);
                    } else if (fileInfo.type === 'front') {
                        onFileDownloaded(source, fileInfo.cardIndex!);
                    } else if (fileInfo.type === 'back') {
                        onFileBackDownloaded(source, fileInfo.cardIndex!);
                    }
                }
            );

            setIsImporting(false);
            setImportProgress(100);

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
        lastImportedOrder,
        handleXMLImport,
        clearError
    };
}
