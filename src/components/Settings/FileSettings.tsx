import { Select, SelectItem } from "@heroui/react";
import { useProjectSettingsStore, PAGE_SIZE_OPTIONS } from "../../stores/projectSettingsStore";

function FileSettings() {
    const pageSize = useProjectSettingsStore((state) => state.pageSize);
    const setPageSize = useProjectSettingsStore((state) => state.setPageSize);

    return (
        <div className="mb-3">
            <Select
                label="Page Size"
                selectedKeys={pageSize}
                onSelectionChange={setPageSize}
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