import { useRef, useState } from "react";
import { FileUp, HelpCircle } from "lucide-react";
import { Button, ButtonGroup, Card, CardBody } from "@heroui/react";
import { useMPCFillImport } from "../hooks/useMPCFillImport";
import { useProjectSettingsStore } from "../stores/projectSettingsStore";
import { useCardStore } from "../stores/cardStore";
import { useCardBackManagement } from "../hooks/useCardBackManagement";
import type { ImageSource } from "../types/card";
import { parseMPCFillXML } from "../utils/mpcfill/xmlParser";
import type { CardImage } from "../types/card";
import XmlHelpModal from "./XmlHelpModal";

export function XMLUpload() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { handleXMLImport, isImporting, importProgress, error, clearError } = useMPCFillImport();
    const [isXmlHelpModalOpen, setIsXmlHelpModalOpen] = useState(false);

    // Get settings and state from store
    const defaultBleed = useProjectSettingsStore((state) => state.defaultBleed);
    const defaultCardBackBleed = useProjectSettingsStore((state) => state.defaultCardBackBleed);
    const cardMap = useCardStore((state) => state.cardMap);
    const cardOrder = useCardStore((state) => state.cardOrder);
    const setCardMap = useCardStore((state) => state.setCardMap);
    const setCardOrder = useCardStore((state) => state.setCardOrder);
    const setEnableCardBacks = useProjectSettingsStore((state) => state.setEnableCardBacks);

    // Get card back management hook
    const { handleUpdateCardBack, handleUpdateDefaultCardBack } = useCardBackManagement();

    /**
     * Fills in a placeholder card once its artwork has downloaded.
     *
     * Only the source is stored; useThumbnailBackfill notices the placeholder
     * has no thumbnail for it and renders one.
     */
    const handleCardDownloaded = (
        image: ImageSource,
        index: number,
        placeholderCardIds: string[],
        backImage?: ImageSource
    ) => {
        const cardId = placeholderCardIds[index];
        if (!cardId) return;

        setCardMap((prev: Map<string, CardImage>) => {
            const card = prev.get(cardId);
            if (!card) return prev;
            const updated = new Map(prev);
            updated.set(cardId, { ...card, image });
            return updated;
        });

        // If this card has a unique back, set it
        if (backImage) {
            setEnableCardBacks(true);
            handleUpdateCardBack(cardId, backImage);
        }
    };

    const handleCardBackDownloaded = (
        cardBack: ImageSource,
        index: number,
        placeholderCardIds: string[]
    ) => {
        const cardId = placeholderCardIds[index];
        if (!cardId) return;

        setCardMap((prev: Map<string, CardImage>) => {
            const card = prev.get(cardId);
            if (!card) return prev;
            const updated = new Map(prev);
            updated.set(cardId, { ...card, cardBack, cardBackThumbnailLoading: true });
            return updated;
        });

        setEnableCardBacks(true);
    };

    const handleCardBackDefaultDownloaded = (cardBack: ImageSource) => {
        setEnableCardBacks(true);
        handleUpdateDefaultCardBack(cardBack);
    };

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
        const placeholderCardIds = parseResult.order.cards.map(() => crypto.randomUUID());
        const newCardMap = new Map(cardMap);
        const newCardOrder = [...cardOrder];

        parseResult.order.cards.forEach((card, index) => {
            const cardId = placeholderCardIds[index];
            newCardMap.set(cardId, {
                id: cardId,
                thumbnail: undefined,
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
            (image: ImageSource, index: number) => {
                handleCardDownloaded(image, index, placeholderCardIds);
            },
            (cardBack: ImageSource, index: number) => {
                handleCardBackDownloaded(cardBack, index, placeholderCardIds);
            },
            handleCardBackDefaultDownloaded,
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
