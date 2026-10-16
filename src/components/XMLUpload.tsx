import { useRef, useState } from "react";
import { FileUp, HelpCircle } from "lucide-react";
import { Button, ButtonGroup, Card, CardBody } from "@heroui/react";
import { useMPCFillImport, type ImportFailure } from "../hooks/useMPCFillImport";
import { useProjectSettingsStore } from "../stores/projectSettingsStore";
import { useCardStore } from "../stores/cardStore";
import { useCardBackManagement } from "../hooks/useCardBackManagement";
import type { ImageSource } from "../types/card";
import { parseMPCFillXML } from "../utils/mpcfill/xmlParser";
import type { CardImage } from "../types/card";
import XmlHelpModal from "./XmlHelpModal";

export function XMLUpload() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { handleXMLImport, isImporting, importProgress, error, errorSeverity, clearError } = useMPCFillImport();
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

    /**
     * Stops a placeholder waiting on artwork that failed to arrive.
     *
     * The card stays in the list, named but empty, so the user can see which
     * ones need replacing by hand instead of losing their place in the order.
     */
    const handleCardFailed = (
        failure: ImportFailure,
        placeholderCardIds: string[]
    ) => {
        if (failure.cardIndex === null) return;
        const cardId = placeholderCardIds[failure.cardIndex];
        if (!cardId) return;

        setCardMap((prev: Map<string, CardImage>) => {
            const card = prev.get(cardId);
            if (!card) return prev;
            const updated = new Map(prev);
            updated.set(cardId, failure.face === 'back'
                ? { ...card, cardBackThumbnailLoading: false }
                : { ...card, thumbnailLoading: false });
            return updated;
        });
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
        const { cards } = parseResult.order;
        const placeholderCardIds = cards.map(() => crypto.randomUUID());
        const newCardMap = new Map(cardMap);
        const newCardOrder = [...cardOrder];

        cards.forEach((card, index) => {
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
        });

        // Each copy is the same card placed again, as duplicating one in the
        // app does, so copies are downloaded once and share their artwork.
        const slotOrder = cards
            .flatMap((card, index) => card.slots.map(slot => ({ slot, cardId: placeholderCardIds[index] })))
            .sort((a, b) => a.slot - b.slot);
        newCardOrder.push(...slotOrder.map(({ cardId }) => cardId));

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
            (failure: ImportFailure) => {
                handleCardFailed(failure, placeholderCardIds);
            },
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
                <Card className={errorSeverity === "warning" ? "border-warning" : "border-danger"}>
                    <CardBody className="p-3">
                        <p className={`text-xs whitespace-pre-wrap ${errorSeverity === "warning" ? "text-warning" : "text-danger"}`}>
                            {error}
                        </p>
                        <Button
                            size="sm"
                            color={errorSeverity === "warning" ? "warning" : "danger"}
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
