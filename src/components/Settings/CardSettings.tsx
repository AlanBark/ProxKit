import { Input, NumberInput } from "@heroui/react";
import { Box } from "../Box";
import { useApp } from "../../context/AppContext";

function CardSettings() {
    const {
        cardWidth,
        setCardWidth,
        cardHeight,
        setCardHeight,
        defaultBleed,
        setDefaultBleed
    } = useApp();

    return (
        <Box>
                <div className="space-y-4 flex space-between flex-col">
                    <NumberInput
                        label="Card Width"
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
                        label="Card Height"
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
                    <NumberInput
                        label="Default Bleed"
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
                </div>
            </Box>
    );
}

export default CardSettings;