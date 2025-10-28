import { Input } from "@heroui/react";
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
                    <Input
                        label="Card Width"
                        type="number"
                        value={cardWidth.toString()}
                        onValueChange={(value) => setCardWidth(parseFloat(value) || 0)}
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
                        radius="sm"
                        labelPlacement="outside"
                        endContent={
                            <span className="text-default-400 text-xs pointer-events-none shrink-0">mm</span>
                        }
                    />
                    <Input
                        label="Default Bleed"
                        type="number"
                        value={defaultBleed.toString()}
                        onValueChange={(value) => setDefaultBleed(parseFloat(value) || 0)}
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