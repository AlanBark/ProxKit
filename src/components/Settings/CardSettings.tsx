import { NumberInput, Checkbox } from "@heroui/react";
import { Box } from "../Box";
import { useApp } from "../../context/AppContext";
import { useRef, useEffect } from "react";
import { Upload } from "lucide-react";

// Helper function to create a white square image
const createWhiteSquare = (width: number, height: number): string => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
    }
    return canvas.toDataURL('image/png');
};

function CardSettings() {
    const {
        cardWidth,
        setCardWidth,
        cardHeight,
        setCardHeight,
        defaultBleed,
        setDefaultBleed,
        enableCardBacks,
        setEnableCardBacks,
        defaultCardBackUrl,
        setDefaultCardBackUrl,
        groupByCardBacks,
        setGroupByCardBacks,
        outputBleed,
        setOutputBleed
    } = useApp();

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize with white square on mount
    useEffect(() => {
        if (!defaultCardBackUrl) {
            setDefaultCardBackUrl(createWhiteSquare(500, 500));
        }
    }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setDefaultCardBackUrl(url);
            // Reset input
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <Box>
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
                        label="Input Bleed"
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


                <div className="pt-2 border-t border-default-200 space-y-3">
                    <div>

                    <Checkbox
                        isSelected={enableCardBacks}
                        onValueChange={setEnableCardBacks}
                        size="sm"
                        >
                        Enable card backs
                    </Checkbox>
                        </div>

                    <div>
                    <Checkbox
                        isSelected={groupByCardBacks}
                        onValueChange={setGroupByCardBacks}
                        size="sm"
                    >
                        Group by card backs
                    </Checkbox>
                    </div>

                    <div>
                        <label className="text-xs text-default-600 mb-2 block">Default Card Back</label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <div className="flex gap-2 items-center">
                            <button
                                onClick={handleUploadClick}
                                className="flex items-center gap-2 px-3 py-2 text-xs bg-default-100 hover:bg-default-200 rounded-md transition-colors"
                            >
                                <Upload className="w-4 h-4" />
                                Upload
                            </button>
                            {defaultCardBackUrl && (
                                <img
                                    src={defaultCardBackUrl}
                                    alt="Default card back"
                                    className="w-12 h-12 object-cover rounded border border-default-300"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Box>
    );
}

export default CardSettings;