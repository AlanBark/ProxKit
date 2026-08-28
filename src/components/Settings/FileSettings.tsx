import { Select, SelectItem } from "@heroui/react";
import { useSettingsStore, PAGE_SIZE_OPTIONS } from "../../stores/settingsStore";
import { LibraryFolderSetting } from "./LibraryFolderSetting";

function FileSettings() {
    const pageSize = useSettingsStore((state) => state.pageSize);
    const setPageSize = useSettingsStore((state) => state.setPageSize);

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

            <div className="mt-3">
                <LibraryFolderSetting />
            </div>
        </div>
    );
}

export default FileSettings;