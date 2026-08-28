import { Download, ChevronRight, HelpCircle, Settings, Save } from "lucide-react";
import { FileUpload } from "../FileUpload";
import { XMLUpload } from "../XMLUpload";
import { Box } from "../Box";
import { textStyles } from "../../theme/classNames";
import { useCardStore } from "../../stores/cardStore";
import { usePDFGeneration } from "../../hooks/usePDFGeneration";
import { basename, dirname } from "../../utils/paths";
import { useDXFGeneration } from "../../hooks/useDXFGeneration";
import { useMPCFillImport } from "../../hooks/useMPCFillImport";
import { Button, ButtonGroup } from '@heroui/react';
import FileSettings from "./FileSettings";
import CardSettings from "./CardSettings";
import gitHubLogo from "../../assets/github-mark-white.svg"
import { useNavigate } from "react-router"
import DxfHelpModal from "./DxfHelpModal";
import { AppSettingsModal } from "./AppSettingsModal";
import { useProjectAutosave } from "../../hooks/useProjectAutosave";
import { useProjectFile } from "../../hooks/useProjectFile";
import { SaveProjectModal } from "./SaveProjectModal";
import { useState } from "react";

export function Sidebar({ className = "" }) {
    const navigate = useNavigate();
    const [isDxfHelpModalOpen, setIsDxfHelpModalOpen] = useState(false);
    const [isAppSettingsOpen, setIsAppSettingsOpen] = useState(false);

    // Get card state from store
    const cardOrder = useCardStore((state) => state.cardOrder);
    const cardMap = useCardStore((state) => state.cardMap);


    // Get PDF state and actions
    const {
        isGenerating,
        generationProgress,
        handleGeneratePDF,
        error: pdfError,
        skipped: skippedCards,
        savedPath,
    } = usePDFGeneration();

    // Get DXF state and actions
    const {
        dxfUrl,
        isGenerating: isDxfGenerating,
        error: dxfError,
        handleDownloadDXF,
    } = useDXFGeneration();

    const { isImporting } = useMPCFillImport();

    const projectPath = useCardStore((state) => state.projectPath);
    const saveState = useProjectAutosave();
    const { saveProjectAs, isBusy: isSavingProject, status: projectStatus } = useProjectFile();
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

    // An unsaved project has no file to go back to, so leaving discards it.
    const handleLeave = async () => {
        if (!projectPath && cardOrder.length > 0) {
            const { ask } = await import("@tauri-apps/plugin-dialog");
            const discard = await ask("This project has not been saved. Discard it?", {
                title: "Unsaved project",
                kind: "warning",
            });
            if (!discard) return;
        }
        navigate('/');
    };

    // Check if any cards are still loading
    const hasLoadingCards = Array.from(cardMap.values()).some(
        card => card.thumbnailLoading || !card.image
    );

    return (
        <div className={`${className} backdrop-blur-sm border-(--border) flex flex-col gap-6 grow min-w-96`}>
            {/* Actions */}
            <Box>
                <div className="flex flex-col gap-3">
                    <div className={`flex justify-between items-center mb-4`}>
                        {/* Breadcrumb */}
                        <div className="flex items-center gap-2 text-lg">
                            <button
                                onClick={handleLeave}
                                className="hover:opacity-70 transition cursor-pointer"
                            >
                                <span className={textStyles.primary}>ProxKit</span>
                            </button>
                            <ChevronRight className="w-4 h-4 opacity-50" />
                            <h1 className={`font-bold ${textStyles.primary}`}>
                                {projectPath
                                    ? basename(projectPath).replace(/\.proxkit$/i, "")
                                    : "Untitled"}
                            </h1>

                            {/* Unsaved work needs a nudge; saved work looks after itself. */}
                            {!projectPath ? (
                                <button
                                    onClick={() => setIsSaveModalOpen(true)}
                                    title="Save project"
                                    aria-label="Save project"
                                    className="cursor-pointer opacity-60 hover:opacity-100 transition"
                                >
                                    <Save className="w-4 h-4" />
                                </button>
                            ) : (
                                saveState.kind !== "idle" && (
                                    <span
                                        className={`text-xs ${saveState.kind === "error" ? "text-danger" : "opacity-50"}`}
                                        title={saveState.kind === "error" ? saveState.message : undefined}
                                    >
                                        {saveState.kind === "saving"
                                            ? "Saving…"
                                            : saveState.kind === "saved"
                                              ? "Saved"
                                              : "Not saved"}
                                    </span>
                                )
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsAppSettingsOpen(true)}
                            aria-label="Application settings"
                            title="Application settings"
                            className="cursor-pointer"
                        >
                            <Settings className="w-6 h-6 opacity-50 hover:opacity-100 transition" />
                        </button>
                        <a href="https://github.com/AlanBark/proxy-print-and-cut" target="_blank" rel="noopener noreferrer">
                            <img src={gitHubLogo} alt="GitHub" className="w-6 h-6 opacity-50 hover:opacity-100 transition" />
                        </a>
                    </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <FileUpload />

                        <Button
                            onPress={handleGeneratePDF}
                            isDisabled={cardOrder.length === 0 || isGenerating || isImporting || hasLoadingCards}
                            isLoading={isGenerating}
                            color={cardOrder.length === 0 ? "default" : pdfError ? "danger" : "success"}
                            variant="ghost"
                            className="relative overflow-hidden"
                        >
                            {/* Loading bar fill */}
                            {isGenerating && (
                                <div
                                    className="absolute inset-0 bg-success/30 transition-all duration-300 ease-out"
                                    style={{
                                        width: `${generationProgress}%`,
                                        left: 0,
                                    }}
                                />
                            )}
                            <span className="flex items-center justify-center gap-2 relative z-10">
                                <Download className="w-5 h-5" />
                                {isGenerating
                                    ? `Generating ${generationProgress}%`
                                    : pdfError ? "PDF Error" : "Generate PDF"}
                            </span>
                        </Button>

                        <XMLUpload />

                        <ButtonGroup className="w-full" fullWidth={true}>
                            <Button
                                onPress={handleDownloadDXF}
                                isDisabled={!dxfUrl || cardOrder.length === 0 || isDxfGenerating}
                                isLoading={isDxfGenerating}
                                color={dxfUrl && !dxfError ? "success" : "default"}
                                variant="ghost"
                            >
                                <span className="flex items-center justify-center gap-2">
                                    <Download className="w-5 h-5" />
                                    {isDxfGenerating ? "Generating..." : dxfError ? "DXF Error" : "Download Cut File"}
                                </span>
                            </Button>
                            <Button
                                isIconOnly
                                color={dxfUrl && !dxfError ? "success" : "default"}
                                variant="ghost"
                                onPress={() => setIsDxfHelpModalOpen(true)}
                            >
                                <HelpCircle />
                            </Button>
                        </ButtonGroup>
                    </div>
                    {projectStatus?.kind === "error" && (
                        <p className="text-sm text-danger break-words">{projectStatus.message}</p>
                    )}

                    {pdfError && (
                        <p className="text-sm text-danger break-words">
                            {pdfError}
                        </p>
                    )}

                    {savedPath && !pdfError && (
                        <p className="text-sm text-success break-words">
                            Saved {basename(savedPath)} to {dirname(savedPath) ?? "disk"}
                        </p>
                    )}

                    {/* The PDF was written; these cards just are not in it. */}
                    {skippedCards.length > 0 && (
                        <p className="text-sm text-warning break-words">
                            {skippedCards.length === 1
                                ? `1 card could not be read and was left out: ${skippedCards[0]}`
                                : `${skippedCards.length} cards could not be read and were left out: ${skippedCards.join(", ")}`}
                        </p>
                    )}
                </div>
            </Box>

            <Box className="grow flex flex-col">
                {/* File Settings */}
                <FileSettings />

                {/* Card Settings */}
                <CardSettings />

                <div className="grow"></div>
            </Box>

            <SaveProjectModal
                isOpen={isSaveModalOpen}
                onClose={() => setIsSaveModalOpen(false)}
                onSave={saveProjectAs}
                isBusy={isSavingProject}
            />

            <AppSettingsModal
                isOpen={isAppSettingsOpen}
                onClose={() => setIsAppSettingsOpen(false)}
            />

            <DxfHelpModal
                isOpen={isDxfHelpModalOpen}
                onClose={() => setIsDxfHelpModalOpen(false)}
            />
        </div>
    );
}
