import { useState } from 'react';
import { parseMPCFillXML } from '../utils/mpcfill/xmlParser';
import { downloadMultipleImages } from '../utils/mpcfill/driveDownloader';
import type { MPCFillOrder } from '../utils/mpcfill/types';

/**
 * Hook for importing card orders from MPCFill XML files.
 *
 * Features:
 * - Parses MPCFill XML format
 * - Downloads card images from Google Drive
 * - Tracks import progress
 * - Handles errors gracefully
 * - Provides callbacks for processed files
 */
export function useMPCFillImport() {
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [lastImportedOrder, setLastImportedOrder] = useState<MPCFillOrder | null>(null);

    const handleXMLImport = async (
        file: File,
        onFileDownloaded: (file: File, index: number) => void,
        onCardBackDownloaded: (file: File) => void
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

            if (order.fronts.length === 0) {
                throw new Error('No cards found in XML file');
            }

            setLastImportedOrder(order);

            // Collect all Drive IDs (fronts + optional card back)
            const frontIds = order.fronts.map(card => card.id);
            const cardBackIds = order.cardback ? [order.cardback] : [];
            const frontCount = frontIds.length;

            // Prepare file info for download
            const allFileInfos = [
                ...frontIds.map((id, index) => ({ id, name: `card_front_${index + 1}.jpg` })),
                ...cardBackIds.map(id => ({ id, name: 'card_back.jpg' }))
            ];

            let completedCount = 0;
            const totalFiles = allFileInfos.length;

            // Download images with per-file callback
            await downloadMultipleImages(
                allFileInfos,
                (file, _id, index) => {
                    completedCount++;
                    const progress = Math.round((completedCount / totalFiles) * 100);
                    setImportProgress(progress);

                    // Call appropriate callback as each file downloads
                    if (index < frontCount) {
                        // front card
                        onFileDownloaded(file, index);
                    } else {
                        // back card
                        onCardBackDownloaded(file);
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
