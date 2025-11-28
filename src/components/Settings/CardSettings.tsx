import { NumberInput, Checkbox, Button } from "@heroui/react";
import { Box } from "../Box";
import { useApp } from "../../context/AppContext";
import { useRef, useState } from "react";
import { Upload, Trash2 } from "lucide-react";

function CardSettings() {
    const {
        cardWidth,
        setCardWidth,
        cardHeight,
        setCardHeight,
        defaultBleed,
        setDefaultBleed,
        defaultCardBackBleed,
        setDefaultCardBackBleed,
        enableCardBacks,
        setEnableCardBacks,
        defaultCardBackUrl,
        defaultCardBackThumbnailUrl,
        handleUpdateDefaultCardBack,
        groupByCardBacks,
        setGroupByCardBacks,
        outputBleed,
        setOutputBleed
    } = useApp();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            handleUpdateDefaultCardBack(file);
            // Reset input
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleDeleteCardBack = () => {
        handleUpdateDefaultCardBack(null);
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-4">
                <NumberInput
                    label="Width"
                    type="number"
                    value={cardWidth}
                    onValueChange={(value) => setCardWidth(value)}
                    min={10}
                    max={300}
                    step={0.1}
                    size="sm"
                    variant="flat"
                    radius="sm"
                    labelPlacement="outside"
                    endContent={
                        <span className="text-default-400 text-xs pointer-events-none shrink-0">mm</span>
                    }
                />

                <NumberInput
                    label="Height"
                    type="number"
                    value={cardHeight}
                    onValueChange={(value) => setCardHeight(value)}
                    min={10}
                    max={300}
                    step={0.1}
                    size="sm"
                    variant="flat"
                    radius="sm"
                    labelPlacement="outside"
                    endContent={
                        <span className="text-default-400 text-xs pointer-events-none shrink-0">mm</span>
                    }
                />
            </div>
            <div className="flex gap-4">
                <NumberInput
                    label="Front Input Bleed"
                    type="number"
                    value={defaultBleed}
                    onValueChange={(value) => setDefaultBleed(value)}
                    min={0}
                    max={10}
                    step={0.1}
                    size="sm"
                    variant="flat"
                    radius="sm"
                    labelPlacement="outside"
                    endContent={
                        <span className="text-default-400 text-xs pointer-events-none shrink-0">mm</span>
                    }
                />

                <NumberInput
                    label="Back Input Bleed"
                    type="number"
                    value={defaultCardBackBleed}
                    onValueChange={(value) => setDefaultCardBackBleed(value)}
                    min={0}
                    max={10}
                    step={0.1}
                    size="sm"
                    variant="flat"
                    radius="sm"
                    labelPlacement="outside"
                    endContent={
                        <span className="text-default-400 text-xs pointer-events-none shrink-0">mm</span>
                    }
                />
            </div>

            <div className="flex gap-4">
                <NumberInput
                    label="Output Bleed"
                    type="number"
                    value={outputBleed}
                    onValueChange={(value) => setOutputBleed(value)}
                    min={0}
                    max={10}
                    step={0.1}
                    size="sm"
                    variant="flat"
                    radius="sm"
                    labelPlacement="outside"
                    endContent={
                        <span className="text-default-400 text-xs pointer-events-none shrink-0">mm</span>
                    }
                />
            </div>


            <div className="pt-4 border-t border-default-200 flex gap-4">
                <div className="flex-1 flex flex-col gap-3">
                    <Checkbox
                        isSelected={enableCardBacks}
                        onValueChange={setEnableCardBacks}
                        size="sm"
                    >
                        Print Card Backs
                    </Checkbox>
                    <Checkbox
                        isSelected={groupByCardBacks}
                        onValueChange={setGroupByCardBacks}
                        size="sm"
                    >
                        Group by Card Backs
                    </Checkbox>
                </div>
                <div className="flex-1 flex items-center justify-center min-h-[200px]">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <div
                        className="p-3 relative rounded border-2 border-dashed border-default-300 cursor-pointer hover:border-default-400 transition-colors w-full h-full"
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                        style={{
                            maxHeight: '300px',
                            aspectRatio: `${cardWidth} / ${cardHeight}`,
                        }}
                    >
                        {defaultCardBackUrl ? (
                            <>
                                <img
                                    src={defaultCardBackThumbnailUrl || defaultCardBackUrl}
                                    alt="Default card back"
                                    className="w-full h-full object-contain rounded"
                                />
                                {/* Upload and Delete Buttons on Hover */}
                                <div
                                    className={`absolute inset-0 gap-[8%] flex items-center justify-center transition-opacity duration-200 ease-in-out ${
                                        isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                    }`}
                                >
                                    <Button
                                        isIconOnly
                                        size="lg"
                                        color="primary"
                                        onPress={handleUploadClick}
                                        className="w-[28%] h-[20%] min-w-10 min-h-10"
                                        title="Upload new card back"
                                    >
                                        <Upload className="w-[50%] h-[50%]" />
                                    </Button>
                                    <Button
                                        isIconOnly
                                        size="lg"
                                        color="danger"
                                        onPress={handleDeleteCardBack}
                                        className="w-[28%] h-[20%] min-w-10 min-h-10"
                                        title="Delete card back"
                                    >
                                        <Trash2 className="w-[30%] h-[30%]" />
                                    </Button>
                                </div>
                            </>
                        ) : (
                            /* Upload Icon when no image */
                            <div
                                className="w-full h-full flex items-center justify-center"
                                onClick={handleUploadClick}
                            >
                                <Upload className="w-[20%] h-[20%] text-default-400" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CardSettings;