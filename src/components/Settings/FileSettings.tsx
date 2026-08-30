import { Select, SelectItem } from "@heroui/react";
import { useProjectSettingsStore, PAGE_SIZE_OPTIONS } from "../../stores/projectSettingsStore";
import { PresetSelect } from "./PresetSelect";

function FileSettings() {
    const pageSize = useProjectSettingsStore((state) => state.pageSize);
    const setPageSize = useProjectSettingsStore((state) => state.setPageSize);

    // Flex gap rather than space-y: HeroUI's outside label puts a margin on an
    // inner wrapper, which collapses through the root and swallows sibling
    // margins. Flex items do not margin-collapse.
    return (
        <div className="mb-3 flex flex-col gap-4">
            <PresetSelect />

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
        </div>
    );
}

export default FileSettings;