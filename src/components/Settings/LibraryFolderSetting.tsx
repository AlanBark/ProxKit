import { Button, Tooltip } from "@heroui/react";
import { FolderOpen, X } from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";
import { isTauri } from "../../utils/platform";
import { textStyles } from "../../theme/classNames";
import { basename } from "../../utils/paths";

/**
 * Chooses the folder that downloaded card images are kept in.
 *
 * Desktop only: the web build has no filesystem to point at, so the whole
 * control is hidden there rather than shown disabled.
 */
export function LibraryFolderSetting() {
    const libraryFolder = useSettingsStore((state) => state.libraryFolder);
    const setLibraryFolder = useSettingsStore((state) => state.setLibraryFolder);

    if (!isTauri) return null;

    const handleChoose = async () => {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
            directory: true,
            multiple: false,
            title: "Choose image library folder",
        });
        if (typeof selected === "string") {
            setLibraryFolder(selected);
        }
    };

    return (
        <div className="mb-3 flex flex-col gap-1">
            <span className={`text-sm ${textStyles.primary}`}>Image Library</span>

            <div className="flex items-center gap-2">
                <Tooltip content={libraryFolder ?? "No folder chosen"} placement="top">
                    <span
                        className={`grow truncate text-xs ${libraryFolder ? textStyles.primary : "opacity-60"}`}
                    >
                        {libraryFolder ? basename(libraryFolder) : "Not set"}
                    </span>
                </Tooltip>

                <Button
                    size="sm"
                    variant="ghost"
                    radius="sm"
                    onPress={handleChoose}
                    startContent={<FolderOpen className="w-4 h-4" />}
                >
                    {libraryFolder ? "Change" : "Choose"}
                </Button>

                {libraryFolder && (
                    <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        radius="sm"
                        aria-label="Clear image library folder"
                        onPress={() => setLibraryFolder(null)}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                )}
            </div>

            <span className="text-xs opacity-60">
                Downloaded card images are kept here and reused by later imports.
            </span>
        </div>
    );
}
