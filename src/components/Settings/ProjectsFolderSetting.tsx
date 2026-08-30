import { useEffect, useState } from "react";
import { Button, Tooltip } from "@heroui/react";
import { FolderOpen, RotateCcw } from "lucide-react";
import { useAppSettingsStore } from "../../stores/appSettingsStore";
import { isTauri } from "../../utils/platform";
import { textStyles } from "../../theme/classNames";
import { basename } from "../../utils/paths";
import { resolveProjectsFolder } from "../../utils/project/browse";

/**
 * Chooses where projects are kept.
 *
 * Unset means the app's own data folder, which is what makes projects work with
 * no setup. The resolved path is shown either way, so it is never a mystery
 * where saved work has gone.
 */
export function ProjectsFolderSetting() {
    const projectsFolder = useAppSettingsStore((state) => state.projectsFolder);
    const setProjectsFolder = useAppSettingsStore((state) => state.setProjectsFolder);
    const [resolved, setResolved] = useState<string | null>(null);

    useEffect(() => {
        if (!isTauri) return;
        let cancelled = false;
        void resolveProjectsFolder(projectsFolder).then((path) => {
            if (!cancelled) setResolved(path);
        });
        return () => {
            cancelled = true;
        };
    }, [projectsFolder]);

    if (!isTauri) return null;

    const handleChoose = async () => {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
            directory: true,
            multiple: false,
            title: "Choose projects folder",
        });
        if (typeof selected === "string") {
            setProjectsFolder(selected);
        }
    };

    return (
        <div className="flex flex-col gap-1">
            <span className={`text-sm ${textStyles.primary}`}>Projects Folder</span>

            <div className="flex items-center gap-2">
                <Tooltip content={resolved ?? "Resolving…"} placement="top">
                    <span className={`grow truncate text-xs ${textStyles.primary}`}>
                        {resolved ? basename(resolved) : "…"}
                    </span>
                </Tooltip>

                <Button
                    size="sm"
                    variant="ghost"
                    radius="sm"
                    onPress={handleChoose}
                    startContent={<FolderOpen className="w-4 h-4" />}
                >
                    {projectsFolder ? "Change" : "Choose"}
                </Button>

                {projectsFolder && (
                    <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        radius="sm"
                        aria-label="Use the default projects folder"
                        title="Use the default folder"
                        onPress={() => setProjectsFolder(null)}
                    >
                        <RotateCcw className="w-4 h-4" />
                    </Button>
                )}
            </div>

            <span className="text-xs opacity-60">
                Existing projects are not moved, so the shelf will only list what is
                in the new folder.
            </span>
        </div>
    );
}
