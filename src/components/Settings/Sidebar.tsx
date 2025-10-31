import { Download, Trash } from "lucide-react";
import { FileUpload } from "../FileUpload";
import { Box } from "../Box";
import { backgroundStyles, buttonStyles, textStyles } from "../../theme/classNames";
import { useApp } from "../../context/AppContext";
import { Button } from '@heroui/react';
import FileSettings from "./FileSettings";
import CardSettings from "./CardSettings";
import gitHubLogo from "../../assets/github-mark-white.svg"

export function Sidebar({ className = "" }) {

    const {
        cardMap,
        isGenerating,
        pdfUrl,
        handleFilesSelected,
        handleDownloadPDF,
        handleRemoveAllCards,
    } = useApp();

    return (
        <div className={`${className} backdrop-blur-sm border-(--border) p-6 flex flex-col gap-6 grow`}>
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
                    <FileUpload
                        onFilesSelected={handleFilesSelected}
                    />

                    <Button
                        onPress={handleDownloadPDF}
                        isDisabled={!pdfUrl || isGenerating}
                        isLoading={isGenerating}
                        color={(!pdfUrl || isGenerating) ? "warning" : "success"}
                    >
                        <span className="flex items-center justify-center gap-2">
                            <Download className="w-5 h-5" />
                            Download PDF
                        </span>
                    </Button>

                    <Button
                        onPress={handleRemoveAllCards}
                        isDisabled={cardMap.entries.length == 0}
                        variant="ghost"
                        color="danger"
                    >
                        <span className="flex items-center justify-center gap-2">
                            <Trash className="w-5 h-5" />
                            Delete All
                        </span>
                    </Button>
                </div>
            </Box>

            {/* File Settings */}
            <FileSettings />

            {/* Card Settings */}
            <CardSettings />

            <div className="grow"></div>
            <p className={`${textStyles.muted} text-xs text-center opacity-60`}>
                © {new Date().getFullYear()} Alec Parkes
            </p>
        </div>
    );
}
