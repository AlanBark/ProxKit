import { useRef, useEffect } from "react";
import { Upload } from "lucide-react";
import { Button } from "@heroui/react";
import { createImageUploadAdapter, type ImageUploadAdapter } from "../adapters";

interface FileUploadProps {
    onFilesSelected: (files: File[]) => void;
    multiple?: boolean;
}

export function FileUpload({ onFilesSelected, multiple = true }: FileUploadProps) {
    const adapterRef = useRef<ImageUploadAdapter | null>(null);

    // Initialize adapter
    useEffect(() => {
        adapterRef.current = createImageUploadAdapter();
    }, []);

    const handleButtonClick = async () => {
        if (!adapterRef.current) return;

        try {
            const files = await adapterRef.current.selectImages(multiple);
            if (files.length > 0) {
                onFilesSelected(files);
            }
        } catch (error) {
            console.error('Failed to select images:', error);
        }
    };

    return (
        <div>
            <Button
                onPress={handleButtonClick}
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
