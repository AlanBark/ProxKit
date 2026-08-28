import { Select, SelectItem } from "@heroui/react";
import { useProjectSettingsStore } from "../../stores/projectSettingsStore";
import { BUILT_IN_PRESETS, matchPreset } from "../../stores/presets";

/**
 * Picks a card format.
 *
 * The active preset is derived from the current settings rather than stored,
 * so editing a card size or bleed by hand drops the selection back to Custom
 * instead of leaving a preset named that no longer describes the job.
 */
export function PresetSelect() {
    const pageSize = useProjectSettingsStore((state) => state.pageSize);
    const cardWidth = useProjectSettingsStore((state) => state.cardWidth);
    const cardHeight = useProjectSettingsStore((state) => state.cardHeight);
    const defaultBleed = useProjectSettingsStore((state) => state.defaultBleed);
    const defaultCardBackBleed = useProjectSettingsStore((state) => state.defaultCardBackBleed);
    const outputBleed = useProjectSettingsStore((state) => state.outputBleed);
    const applyPreset = useProjectSettingsStore((state) => state.applyPreset);

    const active = matchPreset({
        pageSize,
        cardWidth,
        cardHeight,
        defaultBleed,
        defaultCardBackBleed,
        outputBleed,
    });

    return (
        <Select
            label="Preset"
            selectedKeys={active ? new Set([active.id]) : new Set()}
            placeholder="Custom"
            onSelectionChange={(keys) => {
                if (keys === "all") return;
                const [id] = keys;
                const preset = BUILT_IN_PRESETS.find((p) => p.id === id);
                if (preset) applyPreset(preset);
            }}
            size="sm"
            variant="flat"
            radius="sm"
            labelPlacement="outside"
            classNames={{ trigger: "cursor-pointer" }}
        >
            {BUILT_IN_PRESETS.map((preset) => (
                <SelectItem key={preset.id} description={preset.description}>
                    {preset.label}
                </SelectItem>
            ))}
        </Select>
    );
}
