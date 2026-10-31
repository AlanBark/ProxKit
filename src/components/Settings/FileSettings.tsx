import { Checkbox, NumberInput, Popover, PopoverContent, PopoverTrigger, Select, SelectItem } from "@heroui/react";
import { CircleHelp } from "lucide-react";
import { useProjectSettingsStore, PAGE_SIZE_OPTIONS } from "../../stores/projectSettingsStore";
import { useCardSpacing } from "../../hooks/useCardSpacing";
import { useJigHoles } from "../../hooks/useJigHoles";
import { textStyles } from "../../theme/classNames";
import { PresetSelect } from "./PresetSelect";

function FileSettings() {
    const pageSize = useProjectSettingsStore((state) => state.pageSize);
    const setPageSize = useProjectSettingsStore((state) => state.setPageSize);
    const setCardSpacing = useProjectSettingsStore((state) => state.setCardSpacing);
    const maximiseCutSpace = useProjectSettingsStore((state) => state.maximiseCutSpace);
    const setMaximiseCutSpace = useProjectSettingsStore((state) => state.setMaximiseCutSpace);
    const setEnableJigHoles = useProjectSettingsStore((state) => state.setEnableJigHoles);
    const spacing = useCardSpacing();
    const jig = useJigHoles();

    // Cards too large for the page leave no valid spacing at all.
    const fits = spacing.max >= spacing.min;

    // Flex gap rather than space-y: HeroUI's outside label puts a margin on an
    // inner wrapper, which collapses through the root and swallows sibling
    // margins. Flex items do not margin-collapse.
    return (
        <div className="mb-3 flex flex-col gap-4">
            <PresetSelect />

            <div className="flex gap-4 items-start">
                <Select
                    label="Page Size"
                    selectedKeys={pageSize}
                    onSelectionChange={setPageSize}
                    // Without this, picking the already-selected size toggles it off
                    // and leaves the page with no size at all.
                    disallowEmptySelection
                    size="sm"
                    variant="flat"
                    radius="sm"
                    labelPlacement="outside"
                    placeholder="Select page size"
                    classNames={{
                        trigger: "cursor-pointer"
                    }}
                >
                    {PAGE_SIZE_OPTIONS.map((option) => (
                        <SelectItem key={option.key}>
                            {option.label}
                        </SelectItem>
                    ))}
                </Select>

                <NumberInput
                    label={
                        <div className="flex items-center justify-between w-full gap-2">
                            <span>Card Spacing</span>
                            <Popover placement="right" showArrow={true} backdrop='blur'>
                                <PopoverTrigger>
                                    <button className="text-default-400 hover:text-default-600 transition cursor-pointer">
                                        <CircleHelp className="w-4 h-4" />
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent className="border-1">
                                    <div className="p-3 flex flex-col gap-2 max-w-sm">
                                        <p className={`font-bold ${textStyles.primary}`}>Card Spacing</p>
                                        <p className="text-sm">Space between the cut lines of each card.</p>
                                        <p className="text-sm">Default is {spacing.min}mm. Going higher leaves a white gap between cards.</p>
                                        <p className="text-sm">
                                            {fits
                                                ? `Max is ${spacing.max}mm on ${spacing.pageLabel}, any more and the cards hit the registration marks.`
                                                : `These cards are too big to clear the registration marks on ${spacing.pageLabel}.`}
                                        </p>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    }
                    // Disabled, it shows the spacing actually in use.
                    value={maximiseCutSpace ? spacing.effective : spacing.requested}
                    isDisabled={maximiseCutSpace}
                    description={maximiseCutSpace ? "Set by Maximise Cut Space" : undefined}
                    // Cleared input reports NaN; keep the last real value instead.
                    onValueChange={(value) => {
                        if (Number.isFinite(value)) setCardSpacing(value);
                    }}
                    minValue={spacing.min}
                    maxValue={fits ? spacing.max : spacing.min}
                    step={0.1}
                    size="sm"
                    variant="flat"
                    radius="sm"
                    labelPlacement="outside"
                    endContent={
                        <span className="text-default-400 text-xs pointer-events-none shrink-0">mm</span>
                    }
                    // The stored value is kept when a page or card change puts
                    // it out of range, so say what is actually being used.
                    isInvalid={!maximiseCutSpace && (!fits || spacing.requested !== spacing.effective)}
                    errorMessage={
                        !fits
                            ? `These cards reach the registration marks on ${spacing.pageLabel}`
                            : spacing.requested > spacing.max
                                ? `Up to ${spacing.max}mm fits on ${spacing.pageLabel} - using ${spacing.effective}mm`
                                : `At least ${spacing.min}mm, twice the bleed - using ${spacing.effective}mm`
                    }
                />
            </div>

            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                    <Checkbox
                        isSelected={maximiseCutSpace}
                        onValueChange={setMaximiseCutSpace}
                        size="sm"
                    >
                        Maximise Cut Space
                    </Checkbox>
                    <Popover placement="right" showArrow={true} backdrop='blur'>
                        <PopoverTrigger>
                            <button className="text-default-400 hover:text-default-600 transition cursor-pointer">
                                <CircleHelp className="w-4 h-4" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="border-1">
                            <div className="p-3 flex flex-col gap-2 max-w-sm">
                                <p className={`font-bold ${textStyles.primary}`}>Maximise Cut Space</p>
                                <p className="text-sm">Cuts down the middle of the gaps between cards, all the way to the edge of the page.</p>
                                <p className="text-sm">Cards come out larger than card size, with square corners.</p>
                                <p className="text-sm">Card spacing is locked to {spacing.min}mm while this is on.</p>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="flex items-center justify-between gap-2">
                    <Checkbox
                        isSelected={jig.enabled}
                        onValueChange={setEnableJigHoles}
                        size="sm"
                    >
                        Jig Holes
                    </Checkbox>
                    <Popover placement="right" showArrow={true} backdrop='blur'>
                        <PopoverTrigger>
                            <button className="text-default-400 hover:text-default-600 transition cursor-pointer">
                                <CircleHelp className="w-4 h-4" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="border-1">
                            <div className="p-3 flex flex-col gap-2 max-w-sm">
                                <p className={`font-bold ${textStyles.primary}`}>Jig Holes</p>
                                <p className="text-sm">Adds holes for the pressing jig to the cut file. One round hole and one slot, 90mm apart, down the left edge.</p>
                                <p className="text-sm">The cards move over to the bottom right to make room for the holes.</p>
                                <p className="text-sm">Cut just the holes on both sheets first, press them together on the jig, then cut the cards.</p>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
                {jig.enabled && !jig.fits && (
                    <p className="text-xs text-danger">The holes don't fit on {jig.pageLabel} with these cards, so they're left out of the cut file.</p>
                )}
            </div>
        </div>
    );
}

export default FileSettings;
