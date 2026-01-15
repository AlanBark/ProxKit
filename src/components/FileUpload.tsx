import { useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "@heroui/react";
import { useCardFileHandling } from "../hooks/useCardFileHandling";

export function FileUpload() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { handleFilesSelected, openFileSelection } = useCardFileHandling();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            handleFilesSelected(Array.from(files));
        }
        // Reset input so same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
            />
            <Button
                onPress={() => openFileSelection(fileInputRef)}
                className={`w-full`}
                color="primary"
                variant="ghost"
            >
                <span className="flex items-center justify-center gap-2">
                    <Upload className="w-5 h-5" />
                    Upload Images
                </span>
            </Button>
        </div>
    );
}
