import { useRef } from "react";
import { Upload } from "lucide-react";
import { buttonStyles } from "../theme/classNames";

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
}

export function FileUpload({ onFilesSelected, multiple = true }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onFilesSelected(Array.from(files));
      // Reset input to allow selecting the same files again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={handleFileChange}
        className="hidden"
        id="file-upload"
      />
      <label
        htmlFor="file-upload"
        className={`w-full cursor-pointer ${buttonStyles.primary} font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2`}
      >
        <Upload className="w-5 h-5" />
        Upload Images
      </label>
    </div>
  );
}
