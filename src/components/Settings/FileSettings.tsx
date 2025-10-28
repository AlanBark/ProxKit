import { Select, SelectItem } from "@heroui/react";
import { Box } from "../Box";
import { useApp, PAGE_SIZE_OPTIONS } from "../../context/AppContext";

function FileSettings() {
    const {
        pageSize,
        setPageSize
    } = useApp();

    return (
        <Box>
            <Select
                label="Page Size"
                radius="sm"
                labelPlacement="outside"
                selectedKeys={pageSize}
                onSelectionChange={setPageSize}
            >
                {PAGE_SIZE_OPTIONS.map((option) => (
                    <SelectItem 
                        key={option.key}
                    >
                        {option.label}
                    </SelectItem>
                ))}
            </Select>
        </Box>
    );
}

export default FileSettings;