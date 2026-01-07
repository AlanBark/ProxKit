import { NumberInput, Checkbox, Button, Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { usePrintAndCutStore } from "../../stores/printAndCutStore";
import { useCardBackManagement } from "../../hooks/useCardBackManagement";
import { useRef, useState } from "react";
import { Upload, Trash2, CircleHelp } from "lucide-react";
import { textStyles } from "../../theme/classNames";
import frontInputBleedExample from "../../assets/front-input-bleed-example.png";
import doubleSidedExample from "../../assets/double-sided-example.jpg";

function CardSettings() {
    // Get settings from Zustand store
    const cardWidth = usePrintAndCutStore((state) => state.cardWidth);
    const setCardWidth = usePrintAndCutStore((state) => state.setCardWidth);
    const cardHeight = usePrintAndCutStore((state) => state.cardHeight);
    const setCardHeight = usePrintAndCutStore((state) => state.setCardHeight);
    const defaultBleed = usePrintAndCutStore((state) => state.defaultBleed);
    const setDefaultBleed = usePrintAndCutStore((state) => state.setDefaultBleed);
    const defaultCardBackBleed = usePrintAndCutStore((state) => state.defaultCardBackBleed);
    const setDefaultCardBackBleed = usePrintAndCutStore((state) => state.setDefaultCardBackBleed);
    const enableCardBacks = usePrintAndCutStore((state) => state.enableCardBacks);
    const setEnableCardBacks = usePrintAndCutStore((state) => state.setEnableCardBacks);
    const defaultCardBackUrl = usePrintAndCutStore((state) => state.defaultCardBackUrl);
    const defaultCardBackThumbnailUrl = usePrintAndCutStore((state) => state.defaultCardBackThumbnailUrl);
    // const groupByCardBacks = usePrintAndCutStore((state) => state.groupByCardBacks);
    // const setGroupByCardBacks = usePrintAndCutStore((state) => state.setGroupByCardBacks);
    const showAllCardBacks = usePrintAndCutStore((state) => state.showAllCardBacks);
    const setShowAllCardBacks = usePrintAndCutStore((state) => state.setShowAllCardBacks);

    // Get card back management hook
    const { handleUpdateDefaultCardBack } = useCardBackManagement();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            handleUpdateDefaultCardBack(files[0]);
        }
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
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
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
            />
            <div className="flex gap-4">
                <NumberInput
                    label={
                        <div className="flex items-center justify-between w-full gap-2">
                            <span>Width</span>
                        </div>
                    }
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
                    label={
                        <div className="flex items-center justify-between w-full gap-2">
                            <span>Height</span>
                        </div>
                    }
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
                    label={
                        <div className="flex items-center justify-between w-full gap-2">
                            <span>Front Input Bleed</span>
                            <Popover placement="right" showArrow={true} backdrop='blur'>
                                <PopoverTrigger>
                                    <button className="text-default-400 hover:text-default-600 transition cursor-pointer">
                                        <CircleHelp className="w-4 h-4" />
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent className="border-1">
                                    <div className="p-3 flex flex-col gap-2">
                                        <p className={`font-bold ${textStyles.primary}`}>Front Image Bleed</p>
                                        <p>The existing bleed on the image - mm of space outside of the red line.</p>
                                        
                                        <img
                                            src={frontInputBleedExample}
                                            alt="Front Input Bleed Example"
                                            className="max-w-sm"
                                        />
                                        <p>This will usually either be 0mm or 3mm</p>
                                        <p className="text-sm">This can be set on a card by card basis.</p>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    }
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
                    label={
                        <div className="flex items-center justify-between w-full gap-2">
                            <span>Back Input Bleed</span>
                            <Popover placement="right" showArrow={true} backdrop='blur'>
                                <PopoverTrigger>
                                    <button className="text-default-400 hover:text-default-600 transition cursor-pointer">
                                        <CircleHelp className="w-4 h-4" />
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent className="border-1">
                                    <div className="p-3 flex flex-col gap-2">
                                        <p className={`font-bold ${textStyles.primary}`}>Back Image Bleed</p>
                                        <p>The existing bleed on the image - mm of space outside of the red line.</p>
                                        
                                        <img
                                            src={frontInputBleedExample}
                                            alt="Front Input Bleed Example"
                                            className="max-w-sm"
                                        />
                                        <p>This will usually either be 0mm or 3mm</p>
                                        <p className="text-sm">This can be set on a card by card basis.</p>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    }
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

            <div className="pt-4 border-t border-default-200 flex gap-4">
                <div className="flex-1 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                        <Checkbox
                            isSelected={enableCardBacks}
                            onValueChange={setEnableCardBacks}
                            size="sm"
                        >
                            Print Card Backs
                        </Checkbox>
                        <Popover placement="right" showArrow={true} backdrop='blur'>
                            <PopoverTrigger>
                                <button className="text-default-400 hover:text-default-600 transition cursor-pointer">
                                    <CircleHelp className="w-4 h-4" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="border-1">
                                <div className="p-3 flex flex-col gap-2">
                                    <h2 className={`font-bold ${textStyles.primary}`}>Print Card Backs</h2>
                                    <p>Card backs can be set at a global level, then overwritted individually:</p>
                                    <img
                                        src={doubleSidedExample}
                                        alt="Double Sided Print Example"
                                        className="max-w-sm"
                                    />
                                    <p className="text-sm">When printing on a single sided printer, flip the page so that the <br></br>black square is in the top right, facing away from you.</p>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <Checkbox
                            isSelected={showAllCardBacks}
                            onValueChange={setShowAllCardBacks}
                            size="sm"
                        >
                            Show All Card Backs
                        </Checkbox>
                        <Popover placement="right" showArrow={true} backdrop='blur'>
                            <PopoverTrigger>
                                <button className="text-default-400 hover:text-default-600 transition cursor-pointer">
                                    <CircleHelp className="w-4 h-4" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="border-1">
                                <div className="p-3 flex flex-col gap-2">
                                    <p>Toggle to flip between all fronts and backs.</p>
                                    <p>This has no effect on printing.</p>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                <div className="flex-1 flex items-center justify-center min-h-[200px]">
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
                                className="w-full h-full flex items-center justify-center flex-col gap-4"
                                onClick={handleUploadClick}
                            >
                                <Upload className="w-[20%] h-[20%] text-default-400" />
                                Upload Card Back
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CardSettings;