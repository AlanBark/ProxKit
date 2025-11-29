import { useRef } from "react";
import { FileUp } from "lucide-react";
import { Button, Progress, Card, CardBody } from "@heroui/react";
import { useMPCFill } from "../context/MPCFillContext";
import { useApp } from "../context/AppContext";

export function XMLUpload() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { handleXMLImport, isImporting, importProgress, currentFileName, error, clearError } = useMPCFill();
    const { handleFilesSelected, handleUpdateDefaultCardBack, setEnableCardBacks } = useApp();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Clear any previous errors
        clearError();

        // Validate file type
        if (!file.name.toLowerCase().endsWith('.xml')) {
            return;
        }

        // Import the XML file
        await handleXMLImport(file, async (cardFiles, cardBackFile) => {
            // Add front card images to the app
            handleFilesSelected(cardFiles);

            // Set card back if present
            if (cardBackFile) {
                setEnableCardBacks(true);
                await handleUpdateDefaultCardBack(cardBackFile);
            }
        });

        // Reset input to allow selecting the same file again
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="w-full space-y-2">
            <input
                ref={fileInputRef}
                type="file"
                accept=".xml"
                onChange={handleFileChange}
                className="hidden"
            />

            <Button
                onPress={handleButtonClick}
                className="w-full"
                color="secondary"
                variant="ghost"
                isDisabled={isImporting}
            >
                <span className="flex items-center justify-center gap-2">
                    <FileUp className="w-5 h-5" />
                    Import MPCFill XML
                </span>
            </Button>

            {isImporting && (
                <Card>
                    <CardBody className="p-3 space-y-2">
                        <Progress
                            aria-label="Import Progress"
                            size="sm"
                            value={importProgress}
                            color="secondary"
                            showValueLabel={true}
                            className="w-full"
                        />
                        {currentFileName && (
                            <p className="text-xs text-default-500 truncate">
                                {currentFileName}
                            </p>
                        )}
                    </CardBody>
                </Card>
            )}

            {error && (
                <Card className="border-danger">
                    <CardBody className="p-3">
                        <p className="text-xs text-danger whitespace-pre-wrap">
                            {error}
                        </p>
                        <Button
                            size="sm"
                            color="danger"
                            variant="light"
                            onPress={clearError}
                            className="mt-2"
                        >
                            Dismiss
                        </Button>
                    </CardBody>
                </Card>
            )}
        </div>
    );
}
