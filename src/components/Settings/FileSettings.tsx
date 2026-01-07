import { Select, SelectItem } from "@heroui/react";
import { usePrintAndCutStore, PAGE_SIZE_OPTIONS } from "../../stores/printAndCutStore";

function FileSettings() {
    const pageSize = usePrintAndCutStore((state) => state.pageSize);
    const setPageSize = usePrintAndCutStore((state) => state.setPageSize);

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