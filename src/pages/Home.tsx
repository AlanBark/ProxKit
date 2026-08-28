import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button, Spinner } from "@heroui/react";
import { AlertTriangle, FolderOpen, Layers, Plus, Trash2 } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useAppSettingsStore } from "../stores/appSettingsStore";
import { useProjectFile } from "../hooks/useProjectFile";
import {
    listProjects,
    renamedProjectPath,
    resolveProjectsFolder,
    type ProjectSummary,
} from "../utils/project/browse";
import { deleteFile, renameFile } from "../utils/library";
import { textStyles } from "../theme/classNames";
import { isTauri } from "../utils/platform";

const EDITOR_ROUTE = "/print-and-cut";

function formatWhen(ms: number): string {
    if (!ms) return "";
    return new Date(ms).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

/**
 * The landing screen: branding, and the work you can pick up.
 *
 * On desktop that means the project shelf. The browser has no filesystem and so
 * no projects, and gets a single way in instead - the same screen, without a
 * concept it cannot support.
 */
function Home() {
    const navigate = useNavigate();
    const projectsFolder = useAppSettingsStore((state) => state.projectsFolder);
    const { startNewProject, openProjectFromPath, openProjectFromDisk, isBusy, status } =
        useProjectFile();

    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [isLoading, setIsLoading] = useState(isTauri);
    const [renaming, setRenaming] = useState<string | null>(null);
    const [renameError, setRenameError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!isTauri) return;
        setIsLoading(true);
        try {
            setProjects(await listProjects(await resolveProjectsFolder(projectsFolder)));
        } catch (error) {
            console.error("Could not list projects:", error);
            setProjects([]);
        } finally {
            setIsLoading(false);
        }
    }, [projectsFolder]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const handleNew = () => {
        startNewProject();
        navigate(EDITOR_ROUTE);
    };

    const handleOpen = async (project: ProjectSummary) => {
        if (project.error) return;
        if (await openProjectFromPath(project.path)) navigate(EDITOR_ROUTE);
    };

    const handleRename = async (project: ProjectSummary, name: string) => {
        setRenaming(null);
        setRenameError(null);
        const trimmed = name.trim();
        if (!trimmed || trimmed === project.name) return;

        try {
            await renameFile(project.path, await renamedProjectPath(project.path, trimmed));
            await refresh();
        } catch (error) {
            setRenameError(error instanceof Error ? error.message : String(error));
        }
    };

    return (
        <div className="min-h-screen p-6 flex flex-col gap-8">
            <header className="text-center pt-8 space-y-3">
                <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-teal-300 via-cyan-400 to-purple-300 bg-clip-text text-transparent">
                    ProxKit
                </h1>
                <p className={`${textStyles.secondary} text-base md:text-lg`}>
                    Tools for proxy card creation and printing
                </p>
            </header>

            {(status?.kind === "error" || renameError) && (
                <p className="text-sm text-danger text-center break-words">
                    {renameError ?? status?.message}
                </p>
            )}

            <main className="flex-1 w-full max-w-6xl mx-auto">
                {!isTauri ? (
                    // No filesystem in the browser, so no projects to list.
                    <Link
                        to={EDITOR_ROUTE}
                        className="group block max-w-md mx-auto px-8 py-6 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-center"
                    >
                        <span className="text-xl font-medium text-white group-hover:text-cyan-300 transition-colors">
                            Print and Cut
                        </span>
                        <span className={`${textStyles.muted} block text-sm mt-1`}>
                            File generation for Silhouette cutting machines
                        </span>
                    </Link>
                ) : isLoading ? (
                    <div className="flex justify-center py-12">
                        <Spinner />
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {/* New sits first, so starting fresh never means hunting. */}
                        <button
                            onClick={handleNew}
                            disabled={isBusy}
                            className="group aspect-[63/88] rounded-xl border-2 border-dashed border-(--border) flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-50"
                        >
                            <Plus className="w-10 h-10 opacity-50 group-hover:opacity-100 group-hover:text-primary transition" />
                            <span className={`text-sm font-medium ${textStyles.primary}`}>
                                New Project
                            </span>
                        </button>

                        {projects.map((project) => (
                            <div key={project.path} className="group relative">
                                <button
                                    onClick={() => handleOpen(project)}
                                    disabled={isBusy || !!project.error}
                                    title={project.error ?? project.path}
                                    className="w-full aspect-[63/88] rounded-xl overflow-hidden border border-(--border) bg-(--bg-input) flex flex-col hover:border-primary transition-all cursor-pointer disabled:cursor-not-allowed text-left"
                                >
                                    <div className="flex-1 relative overflow-hidden">
                                        {project.error ? (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center">
                                                <AlertTriangle className="w-8 h-8 text-danger opacity-70" />
                                                <span className="text-xs text-danger">Unreadable</span>
                                            </div>
                                        ) : project.coverPath ? (
                                            <img
                                                src={convertFileSrc(project.coverPath, "asset")}
                                                alt=""
                                                className="absolute inset-0 w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Layers className="w-8 h-8 opacity-25" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-2 border-t border-(--border)">
                                        {renaming === project.path ? (
                                            <input
                                                autoFocus
                                                defaultValue={project.name}
                                                onClick={(e) => e.stopPropagation()}
                                                onBlur={(e) => handleRename(project, e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") e.currentTarget.blur();
                                                    if (e.key === "Escape") setRenaming(null);
                                                }}
                                                className="w-full bg-transparent text-sm font-medium outline-none border-b border-primary"
                                            />
                                        ) : (
                                            <p
                                                className={`text-sm font-medium truncate ${textStyles.primary}`}
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    setRenaming(project.path);
                                                }}
                                                title="Double-click to rename"
                                            >
                                                {project.name}
                                            </p>
                                        )}
                                        <p className="text-xs opacity-50">
                                            {project.error
                                                ? "Could not be read"
                                                : `${project.cardCount} card${project.cardCount === 1 ? "" : "s"} · ${formatWhen(project.modifiedMs)}`}
                                        </p>
                                    </div>
                                </button>

                                <Button
                                    isIconOnly
                                    size="sm"
                                    radius="sm"
                                    variant="flat"
                                    aria-label={`Delete ${project.name}`}
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition"
                                    onPress={async () => {
                                        await deleteFile(project.path);
                                        await refresh();
                                    }}
                                >
                                    <Trash2 className="w-4 h-4 text-danger" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            <footer className="flex flex-col items-center gap-3 pb-4">
                <nav className="flex items-center gap-4 text-sm">
                    {isTauri && (
                        <button
                            onClick={async () => {
                                if (await openProjectFromDisk()) navigate(EDITOR_ROUTE);
                            }}
                            className={`flex items-center gap-1 hover:opacity-100 opacity-70 transition cursor-pointer ${textStyles.secondary}`}
                        >
                            <FolderOpen className="w-4 h-4" />
                            Open from disk
                        </button>
                    )}
                    <Link
                        to="/docs"
                        className={`hover:opacity-100 opacity-70 transition ${textStyles.secondary}`}
                    >
                        Documentation
                    </Link>
                </nav>
                <p className={`${textStyles.muted} text-xs opacity-50`}>
                    © {new Date().getFullYear()} Alec Parkes
                </p>
            </footer>
        </div>
    );
}

export default Home;
