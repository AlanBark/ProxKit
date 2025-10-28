import { Download, Printer, Check } from "lucide-react";
import { FileUpload } from "../FileUpload";
import { Box } from "../Box";
import { backgroundStyles, buttonStyles, inputStyles, textStyles } from "../../theme/classNames";
import { useApp } from "../../context/AppContext";
import { Button, Input} from '@heroui/react';
import FileSettings from "./FileSettings";
import CardSettings from "./CardSettings";

export function Sidebar({ className = "" }) {
    
    const {
        cards,
        isGenerating,
        pdfUrl,
        handleFilesSelected,
        handleDownloadPDF,
        handlePrintPDF,
        pageSize,
        setPageSize,
        cardWidth,
        setCardWidth,
        cardHeight,
        setCardHeight,
        defaultBleed,
        setDefaultBleed,
    } = useApp();

    return (
        <div className={`${className} ${backgroundStyles.surface} backdrop-blur-sm border-(--border) p-6 flex flex-col gap-6`}>
            {/* Actions */}
            <Box>
                <div className="flex flex-col gap-3">
                    <FileUpload
                        onFilesSelected={handleFilesSelected}
                    />
                    <Button
                        onPress={handleDownloadPDF}
                        isDisabled={!pdfUrl || isGenerating}
                        className={`w-full ${buttonStyles.primary} font-semibold py-3 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all`}
                    >
                        <span className="flex items-center justify-center gap-2">
                            <Download className="w-5 h-5" />
                            Download PDF
                        </span>
                    </Button>
                    <Button
                        onPress={handlePrintPDF}
                        isDisabled={!pdfUrl || isGenerating}
                        className={`w-full ${buttonStyles.ghost} font-semibold py-3 rounded-lg disabled:bg-(--bg-input) disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
                    >
                        <span className="flex items-center justify-center gap-2">
                            <Printer className="w-5 h-5" />
                            Print
                        </span>
                    </Button>
                </div>
            </Box>

            {/* File Settings */}
            <FileSettings />

            {/* Card Settings */}
            <CardSettings />

            {/* Status */}
            {/* {(isGenerating || pdfUrl) && (
                <Box title="Status">
                    {isGenerating ? (
                        <div className={`flex items-center gap-3 ${textStyles.warning}`}>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-(--warning) border-t-transparent"></div>
                            <span className="text-sm">Generating PDF...</span>
                        </div>
                    ) : pdfUrl ? (
                        <div className={`flex items-center gap-3 ${textStyles.success}`}>
                            <Check className="w-5 h-5" />
                            <span className="text-sm">PDF Ready</span>
                        </div>
                    ) : null}
                </Box>
            )} */}

            <div className="grow"></div>
            <p className={`${textStyles.muted} text-xs text-center opacity-60`}>
                © {new Date().getFullYear()} Alec Parkes
            </p>
        </div>
    );
}
