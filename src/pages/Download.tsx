import { Link } from "react-router";
import { ChevronLeft, Download as DownloadIcon, Github, Package } from "lucide-react";
import { textStyles } from "../theme/classNames";

const REPO = "https://github.com/AlanBark/proxy-print-and-cut";
const LATEST = `${REPO}/releases/latest`;

interface Option {
    id: string;
    label: string;
    detail: string;
    href: string;
    /** The one offered first, when it matches what the visitor is running. */
    platform: "windows" | "any";
}

/**
 * Installer choices.
 *
 * Links point at the release page rather than a pinned asset URL: filenames
 * carry the version, so a direct link would rot on every release.
 */
const OPTIONS: Option[] = [
    {
        id: "nsis",
        label: "Windows installer",
        detail: "Recommended. Sets up ProxKit and keeps it updated automatically.",
        href: LATEST,
        platform: "windows",
    },
    {
        id: "msi",
        label: "Windows MSI",
        detail: "For managed or scripted installs.",
        href: LATEST,
        platform: "windows",
    },
    {
        id: "all",
        label: "All releases",
        detail: "Every version, with release notes and checksums.",
        href: `${REPO}/releases`,
        platform: "any",
    },
];

/** Best guess at the visitor's platform, used only to order the options. */
function isWindows(): boolean {
    if (typeof navigator === "undefined") return false;
    return /win/i.test(navigator.userAgent);
}

function Download() {
    const windowsFirst = isWindows();
    const options = windowsFirst
        ? OPTIONS
        : [...OPTIONS].sort((a, b) => (a.platform === "any" ? -1 : b.platform === "any" ? 1 : 0));

    return (
        <div className="min-h-screen p-6 flex flex-col gap-8">
            <header className="flex items-center gap-3">
                <Link
                    to="/"
                    className="hover:opacity-70 transition"
                    aria-label="Back to home"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <h1 className={`text-2xl font-bold ${textStyles.primary}`}>Download ProxKit</h1>
            </header>

            <main className="w-full max-w-2xl mx-auto flex flex-col gap-6">
                <p className={`${textStyles.secondary} text-sm`}>
                    The desktop app adds an image library, saved projects and much faster
                    PDF generation. The browser version stays available and needs no
                    install.
                </p>

                <div className="flex flex-col gap-3">
                    {options.map((option) => (
                        <a
                            key={option.id}
                            href={option.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-start gap-3 px-5 py-4 rounded-xl border border-(--border) bg-(--bg-surface) hover:bg-(--bg-hover) hover:border-(--border-hover) transition-all"
                        >
                            {option.id === "all" ? (
                                <Github className="w-5 h-5 mt-0.5 opacity-70" />
                            ) : option.id === "msi" ? (
                                <Package className="w-5 h-5 mt-0.5 opacity-70" />
                            ) : (
                                <DownloadIcon className="w-5 h-5 mt-0.5 opacity-70" />
                            )}

                            <span className="flex flex-col">
                                <span
                                    className={`font-medium group-hover:text-(--primary) transition-colors ${textStyles.primary}`}
                                >
                                    {option.label}
                                </span>
                                <span className={`text-sm ${textStyles.muted} opacity-70`}>
                                    {option.detail}
                                </span>
                            </span>
                        </a>
                    ))}
                </div>

                <p className="text-xs opacity-50">
                    Windows may warn that the publisher is unrecognised: the installer is
                    not code-signed. Choose "More info" and then "Run anyway", or verify
                    the download against the checksums on the release page.
                </p>
            </main>
        </div>
    );
}

export default Download;
