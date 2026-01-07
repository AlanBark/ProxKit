import { Download, ChevronRight, HelpCircle } from "lucide-react";
import { FileUpload } from "../FileUpload";
import { XMLUpload } from "../XMLUpload";
import { Box } from "../Box";
import { textStyles } from "../../theme/classNames";
import { usePrintAndCutStore } from "../../stores/printAndCutStore";
import { useCardFileHandling } from "../../hooks/useCardFileHandling";
import { usePDFGeneration } from "../../hooks/usePDFGeneration";
import { useMPCFillImport } from "../../hooks/useMPCFillImport";
import { Button, ButtonGroup } from '@heroui/react';
import FileSettings from "./FileSettings";
import CardSettings from "./CardSettings";
import gitHubLogo from "../../assets/github-mark-white.svg"
import { useNavigate } from "react-router"
import DxfHelpModal from "./DxfHelpModal";
import { useState } from "react";

export function Sidebar({ className = "" }) {
    const navigate = useNavigate();
    const [isDxfHelpModalOpen, setIsDxfHelpModalOpen] = useState(false);

    // Get card state from store
    const cardOrder = usePrintAndCutStore((state) => state.cardOrder);
    const cardMap = usePrintAndCutStore((state) => state.cardMap);

    // Get card file handling hook
    const { handleFilesSelected } = useCardFileHandling();

    // Get PDF state and actions
    const {
        isGenerating,
        generationProgress,
        dxfUrl,
        handleGeneratePDF,
        handleDownloadDXF,
    } = usePDFGeneration();

    const { isImporting } = useMPCFillImport();

    // Check if any cards are still loading
    const hasLoadingCards = Array.from(cardMap.values()).some(
        card => card.thumbnailLoading || !card.imageUrl
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
                                onClick={() => navigate('/')}
                                className="hover:opacity-70 transition cursor-pointer"
                            >
                                <span className={textStyles.primary}>ProxKit</span>
                            </button>
                            <ChevronRight className="w-4 h-4 opacity-50" />
                            <h1 className={`font-bold ${textStyles.primary}`}>
                                Print and Cut
                            </h1>
                        </div>
                        <div className="">
                        <a href="https://github.com/AlanBark/proxy-print-and-cut" target="_blank" rel="noopener noreferrer">
                            <img src={gitHubLogo} alt="GitHub" className="w-6 h-6 opacity-50 hover:opacity-100 transition" />
                        </a>
                    </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <FileUpload
                            onFilesSelected={handleFilesSelected}
                        />

                        <Button
                            onPress={handleGeneratePDF}
                            isDisabled={cardOrder.length === 0 || isGenerating || isImporting || hasLoadingCards}
                            isLoading={isGenerating}
                            color={cardOrder.length === 0 ? "default" : "success"}
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
                                Generate PDF
                            </span>
                        </Button>

                        <XMLUpload />

                        <ButtonGroup className="w-full" fullWidth={true}>
                            <Button
                                onPress={handleDownloadDXF}
                                isDisabled={!dxfUrl}
                                color={!dxfUrl ? "default" : "success"}
                                variant="ghost"
                            >
                                <span className="flex items-center justify-center gap-2">
                                    <Download className="w-5 h-5" />
                                    Download Cut File
                                </span>
                            </Button>
                            <Button
                                isIconOnly
                                color={!dxfUrl ? "default" : "success"}
                                variant="ghost"
                                onPress={() => setIsDxfHelpModalOpen(true)}
                            >
                                <HelpCircle />
                            </Button>
                        </ButtonGroup>
                    </div>
                </div>
            </Box>

            <Box className="grow flex flex-col">
                {/* File Settings */}
                <FileSettings />

                {/* Card Settings */}
                <CardSettings />

                <div className="grow"></div>
            </Box>

            <DxfHelpModal
                isOpen={isDxfHelpModalOpen}
                onClose={() => setIsDxfHelpModalOpen(false)}
            />
        </div>
    );
}
