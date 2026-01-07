import { useRef, useState } from "react";
import { FileUp, HelpCircle } from "lucide-react";
import { Button, ButtonGroup, Card, CardBody } from "@heroui/react";
import { useMPCFillImport } from "../hooks/useMPCFillImport";
import { usePrintAndCutStore } from "../stores/printAndCutStore";
import { useCardBackManagement } from "../hooks/useCardBackManagement";
import { parseMPCFillXML } from "../utils/mpcfill/xmlParser";
import type { CardImage } from "../types/card";
import { generateThumbnailAsync } from "../utils/asyncThumbnailGeneration";
import XmlHelpModal from "./XmlHelpModal";

export function XMLUpload() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { handleXMLImport, isImporting, importProgress, error, clearError } = useMPCFillImport();
    const [isXmlHelpModalOpen, setIsXmlHelpModalOpen] = useState(false);

    // Get settings and state from store
    const defaultBleed = usePrintAndCutStore((state) => state.defaultBleed);
    const defaultCardBackBleed = usePrintAndCutStore((state) => state.defaultCardBackBleed);
    const cardWidth = usePrintAndCutStore((state) => state.cardWidth);
    const cardHeight = usePrintAndCutStore((state) => state.cardHeight);
    const cardMap = usePrintAndCutStore((state) => state.cardMap);
    const cardOrder = usePrintAndCutStore((state) => state.cardOrder);
    const setCardMap = usePrintAndCutStore((state) => state.setCardMap);
    const setCardOrder = usePrintAndCutStore((state) => state.setCardOrder);
    const setEnableCardBacks = usePrintAndCutStore((state) => state.setEnableCardBacks);

    // Get card back management hook
    const { handleUpdateDefaultCardBack } = useCardBackManagement();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        clearError();

        if (!file.name.toLowerCase().endsWith('.xml')) {
            return;
        }

        // Parse XML to get card information
        const xmlContent = await file.text();
        const parseResult = parseMPCFillXML(xmlContent);

        if (parseResult.errors.length > 0) {
            const criticalErrors = parseResult.errors.filter(err => !err.includes('optional'));
            if (criticalErrors.length > 0) {
                return;
            }
        }

        // Create placeholder cards immediately with skeleton state
        const placeholderCardIds = parseResult.order.fronts.map(() => crypto.randomUUID());
        const newCardMap = new Map(cardMap);
        const newCardOrder = [...cardOrder];

        parseResult.order.fronts.forEach((card, index) => {
            const cardId = placeholderCardIds[index];
            newCardMap.set(cardId, {
                id: cardId,
                imageUrl: '', // Empty string will be handled by Card component
                thumbnailUrl: undefined,
                thumbnailLoading: true, // Show loading state
                name: card.name,
                bleed: defaultBleed,
                useCustomBleed: false,
                cardBackBleed: defaultCardBackBleed,
                useCustomCardBackBleed: false,
            });
            newCardOrder.push(cardId);
        });

        setCardMap(newCardMap);
        setCardOrder(newCardOrder);

        // Start XML import with callbacks
        await handleXMLImport(
            file,
            async (downloadedFile, index) => {
                const cardId = placeholderCardIds[index];
                if (!cardId) return;

                const imageUrl = URL.createObjectURL(downloadedFile);

                // Generate thumbnail asynchronously
                try {
                    const thumbnailUrl = await generateThumbnailAsync(
                        downloadedFile,
                        800,
                        800,
                        0.85,
                        defaultBleed,
                        cardWidth,
                        cardHeight
                    );
                    setCardMap((prev: Map<string, CardImage>) => {
                        const updated = new Map(prev);
                        const card = updated.get(cardId);
                        if (card) {
                            updated.set(cardId, {
                                ...card,
                                imageUrl,
                                thumbnailUrl,
                                thumbnailLoading: false,
                            });
                        }
                        return updated;
                    });
                } catch (error) {
                    console.error(`Failed to generate thumbnail for ${downloadedFile.name}:`, error);
                    setCardMap((prev: Map<string, CardImage>) => {
                        const updated = new Map(prev);
                        const card = updated.get(cardId);
                        if (card) {
                            updated.set(cardId, {
                                ...card,
                                imageUrl,
                                thumbnailLoading: false,
                            });
                        }
                        return updated;
                    });
                }
            },
            async (cardBackFile) => {
                setEnableCardBacks(true);
                await handleUpdateDefaultCardBack(cardBackFile);
            }
        );

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
            <ButtonGroup className="w-full" fullWidth={true}>
                <Button
                    onPress={handleButtonClick}
                    className="w-full relative overflow-hidden"
                    color="secondary"
                    variant="ghost"
                    isDisabled={isImporting}
                    isLoading={isImporting}
                >
                    {/* Loading bar fill */}
                    {isImporting && (
                        <div
                            className="absolute inset-0 bg-secondary/30 transition-all duration-300 ease-out"
                            style={{
                                width: `${importProgress}%`,
                                left: 0,
                            }}
                        />
                    )}
                    <span className="flex items-center justify-center gap-2 relative z-10">
                        <FileUp className="w-5 h-5" />
                        Import MPCFill XML
                    </span>
                </Button>
                <Button
                    isIconOnly
                    color="secondary"
                    variant="ghost"
                    onPress={() => setIsXmlHelpModalOpen(true)}
                >
                    <HelpCircle />
                </Button>
            </ButtonGroup>

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

            <XmlHelpModal
                isOpen={isXmlHelpModalOpen}
                onClose={() => setIsXmlHelpModalOpen(false)}
            />
        </div>
    );
}
