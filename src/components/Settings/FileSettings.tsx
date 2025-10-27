
import { Box } from "../Box";
import { useApp, PAGE_SIZE_OPTIONS } from "../../context/AppContext";

function FileSettings() {
    const {
        pageSize,
        setPageSize
    } = useApp();

    return (
        <Box title="Page Size">
            
        </Box>
    );
}

export default FileSettings;