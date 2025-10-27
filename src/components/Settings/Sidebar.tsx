import { Download, Printer, Check } from "lucide-react";
import { FileUpload } from "../FileUpload";
import { Box } from "../Box";
import { backgroundStyles, buttonStyles, inputStyles, textStyles } from "../../theme/classNames";
import { useApp } from "../../context/AppContext";
import { Button, Input} from '@heroui/react';
import FileSettings from "./FileSettings";

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
            <Box>
                <div className="space-y-3">
                    <Input
                        label="Card Width"
                        variant="flat"
                        radius="md"
                        value={cardWidth.toString()}
                    />
                    <Input
                        label="Card Height"
                        type="number"
                        value={cardHeight.toString()}
                        onValueChange={(value) => setCardHeight(parseFloat(value) || 0)}
                        min={10}
                        max={300}
                        step={0.1}
                        size="sm"
                        variant="flat"
                        radius="md"
                        labelPlacement="outside"
                        endContent={
                            <span className={`${textStyles.muted} text-sm pointer-events-none shrink-0`}>mm</span>
                        }
                        classNames={{
                            base: "w-full",
                            label: `text-xs ${textStyles.secondary} pb-1`,
                            inputWrapper: `${inputStyles.default} rounded-lg min-h-0 h-9`,
                            input: `text-sm ${textStyles.primary}`,
                            innerWrapper: "gap-1",
                        }}
                    />
                    <Input
                        label="Default Bleed"
                        type="number"
                        value={defaultBleed.toString()}
                        onValueChange={(value) => setDefaultBleed(parseFloat(value) || 0)}
                        min={0}
                        max={10}
                        step={0.5}
                        size="sm"
                        variant="flat"
                        radius="md"
                        labelPlacement="outside"
                        endContent={
                            <span className={`${textStyles.muted} text-sm pointer-events-none shrink-0`}>mm</span>
                        }
                        classNames={{
                            base: "w-full",
                            label: `text-xs ${textStyles.secondary} pb-1`,
                            inputWrapper: `${inputStyles.default} rounded-lg min-h-0 h-9`,
                            input: `text-sm ${textStyles.primary}`,
                            innerWrapper: "gap-1",
                        }}
                    />
                </div>
            </Box>

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
