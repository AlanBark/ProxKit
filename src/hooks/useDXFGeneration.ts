import { useState, useEffect, useRef, useCallback } from "react";
import { useProjectSettingsStore, PAGE_SIZE_OPTIONS } from "../stores/projectSettingsStore";
import { useCardStore } from "../stores/cardStore";
import { useCardSpacing } from "./useCardSpacing";
import { dxfStringToBlob, generateCentreLineDxf, generateDxfForAllPages } from "../utils/pdf/dxfGenerator";
import { layoutPages, slotsToCards } from "../utils/pdf/cardLayoutUtils";
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../utils/platform';
import { dirname, joinPath } from '../utils/paths';
import { useAppSettingsStore } from '../stores/appSettingsStore';

/**
 * Hook for managing DXF cut file generation from card data.
 */
export function useDXFGeneration() {
    const [dxfUrl, setDxfUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // The live URL, mirrored into a ref so cleanup paths revoke the CURRENT one
    // rather than whatever the effect closed over when it last ran.
    const dxfUrlRef = useRef<string | null>(null);

    const replaceDxfUrl = useCallback((url: string | null) => {
        if (dxfUrlRef.current) {
            URL.revokeObjectURL(dxfUrlRef.current);
        }
        dxfUrlRef.current = url;
        setDxfUrl(url);
    }, []);

    // Get card and settings from store
    const cardMap = useCardStore((state) => state.cardMap);
    const cardOrder = useCardStore((state) => state.cardOrder);
    const pageSize = useProjectSettingsStore((state) => state.pageSize);
    const cardWidth = useProjectSettingsStore((state) => state.cardWidth);
    const cardHeight = useProjectSettingsStore((state) => state.cardHeight);
    const cardSpacing = useCardSpacing().effective;
    const maximiseCutSpace = useProjectSettingsStore((state) => state.maximiseCutSpace);
    const skipSlots = useProjectSettingsStore((state) => state.skipSlots);
    const lastOutputDir = useAppSettingsStore((state) => state.lastOutputDir);
    const setLastOutputDir = useAppSettingsStore((state) => state.setLastOutputDir);

    // Clear DXF URL when cards are removed
    useEffect(() => {
        if (cardOrder.length === 0) {
            replaceDxfUrl(null);
            setError(null);
        }
    }, [cardOrder.length, replaceDxfUrl]);

    // Auto-generate DXF when card data or settings change
    useEffect(() => {
        // Don't generate if there are no cards
        if (cardOrder.length === 0) {
            return;
        }

        const generateDxf = async () => {
            setIsGenerating(true);
            setError(null);

            try {
                // Get page settings
                const selectedKey = Array.from(pageSize)[0] as string;
                const selectedPage = PAGE_SIZE_OPTIONS.find(p => p.key === selectedKey);
                const pageSettings = selectedPage
                    ? { width: selectedPage.width, height: selectedPage.height, margin: 10 }
                    : { width: 210, height: 297, margin: 10 };

                // Maximise Cut Space cuts the gaps, not the cards, so the
                // card list does not change it.
                const dxfContent = maximiseCutSpace
                    ? generateCentreLineDxf(pageSettings, cardWidth, cardHeight, cardSpacing)
                    : generateDxfForAllPages(
                        slotsToCards(layoutPages(cardOrder, cardMap, skipSlots)),
                        pageSettings,
                        cardWidth,
                        cardHeight,
                        cardSpacing,
                        []
                    );

                replaceDxfUrl(URL.createObjectURL(dxfStringToBlob(dxfContent)));
            } catch (err) {
                console.error("Failed to generate DXF:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
                replaceDxfUrl(null);
            } finally {
                setIsGenerating(false);
            }
        };

        generateDxf();

    }, [cardMap, cardOrder, pageSize, cardWidth, cardHeight, cardSpacing, maximiseCutSpace, skipSlots, replaceDxfUrl]);

    // Release the last URL when the hook goes away.
    useEffect(() => () => {
        if (dxfUrlRef.current) {
            URL.revokeObjectURL(dxfUrlRef.current);
            dxfUrlRef.current = null;
        }
    }, []);

    const handleDownloadDXF = async () => {
        if (!dxfUrl) return;

        const fileName = `cut-file-${new Date().getTime()}.dxf`;

        if (!isTauri) {
            const link = document.createElement("a");
            link.href = dxfUrl;
            link.download = fileName;
            link.click();
            return;
        }

        // Desktop: go through the native save dialog, as PDF export does. An
        // <a download> is inert or inconsistent inside a webview.
        try {
            const path = await save({
                title: 'Save Cut File',
                defaultPath: lastOutputDir ? joinPath(lastOutputDir, fileName) : fileName,
                filters: [{ name: 'DXF', extensions: ['dxf'] }],
            });
            if (path === null) return;

            const contents = await (await fetch(dxfUrl)).text();
            await invoke('save_text_file', { path, contents });
            setLastOutputDir(dirname(path));
        } catch (err) {
            console.error("Failed to save DXF:", err);
            setError(
                typeof err === "string" ? err
                    : err instanceof Error ? err.message
                    : "Could not save the cut file"
            );
        }
    };

    return {
        dxfUrl,
        isGenerating,
        error,
        handleDownloadDXF
    };
}
