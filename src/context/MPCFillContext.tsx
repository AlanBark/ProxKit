import { createContext, useContext, useState, useRef, useEffect, type ReactNode } from 'react';
import { createMPCFillImportAdapter, type MPCFillImportAdapter } from '../adapters';
import { parseMPCFillXML } from '../utils/mpcfill/xmlParser';
import type { MPCFillOrder } from '../utils/mpcfill/types';

interface MPCFillState {
    isImporting: boolean;
    importProgress: number;
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
    const [importProgress, setImportProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [lastImportedOrder, setLastImportedOrder] = useState<MPCFillOrder | null>(null);
    const adapterRef = useRef<MPCFillImportAdapter | null>(null);

    // Initialize adapter
    useEffect(() => {
        adapterRef.current = createMPCFillImportAdapter();
    }, []);

    const handleXMLImport = async (
        file: File,
        onFileDownloaded: (file: File, index: number) => void,
        onCardBackDownloaded: (file: File) => void
    ) => {
        if (!adapterRef.current) {
            setError('Adapter not initialized');
            return;
        }

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
            const allIds = [...frontIds, ...cardBackIds];
            const frontCount = frontIds.length;
            const totalFiles = allIds.length;

            // Download images using adapter
            const downloadedFiles = await adapterRef.current.downloadImages(
                allIds,
                (current, _total, _percentage) => {
                    const progress = Math.round((current / totalFiles) * 100);
                    setImportProgress(progress);
                }
            );

            // Process downloaded files
            downloadedFiles.forEach((file, index) => {
                if (index < frontCount) {
                    // front
                    onFileDownloaded(file, index);
                } else {
                    // back
                    onCardBackDownloaded(file);
                }
            });

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

    const value: MPCFillState = {
        isImporting,
        importProgress,
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
