import { createContext, useContext, useState, type ReactNode } from 'react';
import { parseMPCFillXML } from '../utils/mpcfill/xmlParser';
import { downloadMultipleImages } from '../utils/mpcfill/driveDownloader';
import type { MPCFillOrder } from '../utils/mpcfill/types';

interface MPCFillState {
    isImporting: boolean;
    importProgress: number;
    currentFileName: string;
    error: string | null;
    lastImportedOrder: MPCFillOrder | null;

    handleXMLImport: (file: File, onSuccess: (files: File[], cardBackFile: File | null) => void) => Promise<void>;
    clearError: () => void;
}

const MPCFillContext = createContext<MPCFillState | undefined>(undefined);

export function MPCFillProvider({ children }: { children: ReactNode }) {
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [currentFileName, setCurrentFileName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [lastImportedOrder, setLastImportedOrder] = useState<MPCFillOrder | null>(null);

    const handleXMLImport = async (
        file: File,
        onSuccess: (files: File[], cardBackFile: File | null) => void
    ) => {
        setIsImporting(true);
        setImportProgress(0);
        setCurrentFileName('');
        setError(null);

        let order: MPCFillOrder | null = null;

        try {
            // Step 1: Read and parse XML file
            setCurrentFileName('Parsing XML file...');
            const xmlContent = await file.text();
            const parseResult = parseMPCFillXML(xmlContent);

            // Check for parse errors
            if (parseResult.errors.length > 0) {
                const criticalErrors = parseResult.errors.filter(
                    err => !err.includes('optional')
                );
                if (criticalErrors.length > 0) {
                    throw new Error(`XML parsing errors:\n${criticalErrors.join('\n')}`);
                }
            }

            order = parseResult.order;

            if (order.fronts.length === 0) {
                throw new Error('No cards found in XML file');
            }

            setLastImportedOrder(order);

            // Step 2: Download front card images
            setCurrentFileName('Downloading card images...');
            const frontFiles = order.fronts.map(card => ({
                id: card.id,
                name: card.name
            }));

            const downloadedFronts = await downloadMultipleImages(
                frontFiles,
                (current, total, fileName) => {
                    const progress = (current / (total + (order.cardback ? 1 : 0))) * 100;
                    setImportProgress(Math.round(progress));
                    setCurrentFileName(fileName || 'Downloading...');
                }
            );

            // Step 3: Download card back image if present
            let cardBackFile: File | null = null;
            if (order.cardback) {
                setCurrentFileName('Downloading card back...');
                const cardBackResult = await downloadMultipleImages(
                    [{ id: order.cardback, name: 'card-back.jpg' }],
                    (current, total, fileName) => {
                        const progress = ((frontFiles.length + current) / (frontFiles.length + 1)) * 100;
                        setImportProgress(Math.round(progress));
                        setCurrentFileName(fileName || 'Downloading card back...');
                    }
                );
                cardBackFile = cardBackResult[0].file;
            }

            // Step 4: Convert to File array and call success callback
            const files = downloadedFronts.map(result => result.file);

            setImportProgress(100);
            setCurrentFileName('Import complete!');

            // Call success callback with downloaded files
            onSuccess(files, cardBackFile);

            // Reset state after a short delay
            setTimeout(() => {
                setIsImporting(false);
                setImportProgress(0);
                setCurrentFileName('');
            }, 1000);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
            setIsImporting(false);
            setImportProgress(0);
            setCurrentFileName('');
            console.error('MPCFill import error:', err);
        }
    };

    const clearError = () => {
        setError(null);
    };

    const value: MPCFillState = {
        isImporting,
        importProgress,
        currentFileName,
        error,
        lastImportedOrder,
        handleXMLImport,
        clearError
    };

    return (
        <MPCFillContext.Provider value={value}>
            {children}
        </MPCFillContext.Provider>
    );
}

export function useMPCFill() {
    const context = useContext(MPCFillContext);
    if (context === undefined) {
        throw new Error('useMPCFill must be used within an MPCFillProvider');
    }
    return context;
}
