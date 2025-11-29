import { createContext, useContext, useState, type ReactNode } from 'react';
import { parseMPCFillXML } from '../utils/mpcfill/xmlParser';
import { downloadMultipleImages } from '../utils/mpcfill/driveDownloader';
import type { MPCFillOrder } from '../utils/mpcfill/types';

interface MPCFillState {
    isImporting: boolean;
    error: string | null;
    lastImportedOrder: MPCFillOrder | null;

    handleXMLImport: (
        file: File,
        onFileDownloaded: (file: File, index: number) => void,
        onCardBackDownloaded: (file: File) => void
    ) => Promise<void>;
    clearError: () => void;
}

const MPCFillContext = createContext<MPCFillState | undefined>(undefined);

export function MPCFillProvider({ children }: { children: ReactNode }) {
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastImportedOrder, setLastImportedOrder] = useState<MPCFillOrder | null>(null);

    const handleXMLImport = async (
        file: File,
        onFileDownloaded: (file: File, index: number) => void,
        onCardBackDownloaded: (file: File) => void
    ) => {
        setIsImporting(true);
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

            const frontFiles = order.fronts.map(card => ({
                id: card.id,
                name: card.name
            }));

            // Download front card images with callback for each completed download
            await downloadMultipleImages(
                frontFiles,
                (file, _id, index) => {
                    onFileDownloaded(file, index);
                }
            );

            // Download card back if present
            if (order.cardback) {
                await downloadMultipleImages(
                    [{ id: order.cardback, name: 'card-back.jpg' }],
                    (file) => {
                        onCardBackDownloaded(file);
                    }
                );
            }

            setIsImporting(false);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
            setIsImporting(false);
            console.error('MPCFill import error:', err);
        }
    };

    const clearError = () => {
        setError(null);
    };

    const value: MPCFillState = {
        isImporting,
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
