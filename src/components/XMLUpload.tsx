import { useRef } from "react";
import { FileUp } from "lucide-react";
import { Button, Card, CardBody } from "@heroui/react";
import { useMPCFill } from "../context/MPCFillContext";
import { useApp } from "../context/AppContext";
import { parseMPCFillXML } from "../utils/mpcfill/xmlParser";
import type { CardImage } from "../types/card";
import { createThumbnail } from "../utils/imageUtils";

export function XMLUpload() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { handleXMLImport, isImporting, error, clearError } = useMPCFill();
    const { handleUpdateDefaultCardBack, setEnableCardBacks, defaultBleed, defaultCardBackBleed, cardWidth, cardHeight, cardMap, cardOrder, setCardMap, setCardOrder } = useApp();

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

                // Generate thumbnail
                const generateThumbnailFn = () => {
                    return createThumbnail(downloadedFile, 800, 800, 0.85, defaultBleed, cardWidth, cardHeight);
                };

                const thumbnailPromise = 'requestIdleCallback' in window
                    ? new Promise<string>((resolve, reject) => {
                        requestIdleCallback(async () => {
                            try {
                                const url = await generateThumbnailFn();
                                resolve(url);
                            } catch (error) {
                                reject(error);
                            }
                        });
                    })
                    : new Promise<string>((resolve, reject) => {
                        setTimeout(async () => {
                            try {
                                const url = await generateThumbnailFn();
                                resolve(url);
                            } catch (error) {
                                reject(error);
                            }
                        }, 0);
                    });

                try {
                    const thumbnailUrl = await thumbnailPromise;
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
