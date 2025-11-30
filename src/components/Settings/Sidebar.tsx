import { Download, Save, ArchiveRestore } from "lucide-react";
import { FileUpload } from "../FileUpload";
import { XMLUpload } from "../XMLUpload";
import { Box } from "../Box";
import { textStyles } from "../../theme/classNames";
import { useApp } from "../../context/AppContext";
import { useMPCFill } from "../../context/MPCFillContext";
import { Button } from '@heroui/react';
import FileSettings from "./FileSettings";
import CardSettings from "./CardSettings";
import gitHubLogo from "../../assets/github-mark-white.svg"

export function Sidebar({ className = "" }) {

    const {
        cardOrder,
        isGenerating,
        generationProgress,
        dxfUrl,
        handleFilesSelected,
        handleGeneratePDF,
        handleDownloadDXF,
        cardMap,
    } = useApp();

    const { isImporting } = useMPCFill();

    // Check if any cards are still loading
    const hasLoadingCards = Array.from(cardMap.values()).some(
        card => card.thumbnailLoading || !card.imageUrl
    );

    return (
        <div className={`${className} backdrop-blur-sm border-(--border) p-6 flex flex-col gap-6 grow min-w-96`}>
            {/* Actions */}
            <Box>
                <div className="flex flex-col gap-3">
                    <div className={`text-xl flex justify-between`}>
                        <h1 className={`mb-4 font-bold ${textStyles.primary}`}>
                            Proxy Print and Cut
                        </h1>
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
                    </div>
                </div>
            </Box>

            <Box className="grow flex flex-col">
                {/* File Settings */}
                <FileSettings />

                {/* Card Settings */}
                <CardSettings />

                <div className="grow"></div>

                <p className={`${textStyles.muted}  text-xs text-center opacity-60`}>
                © {new Date().getFullYear()} Alec Parkes
                </p>
            </Box>
            
        </div>
    );
}
