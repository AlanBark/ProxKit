import { Button, Progress } from "@heroui/react";
import { RefreshCw, Check, AlertTriangle, Download } from "lucide-react";
import { useUpdater } from "../../hooks/useUpdater";
import { textStyles } from "../../theme/classNames";

/** Shows the installed version and offers an update when one exists. */
export function UpdateSetting() {
    const { state, currentVersion, check, install } = useUpdater();

    const isBusy = state.kind === "checking" || state.kind === "downloading";

    return (
        <div className="flex flex-col gap-2">
            <span className={`text-sm ${textStyles.primary}`}>Updates</span>

            <div className="flex items-center gap-3">
                <span className="grow text-xs opacity-70">
                    {currentVersion ? `Version ${currentVersion}` : "Version unknown"}
                </span>

                {state.kind === "available" ? (
                    <Button
                        size="sm"
                        radius="sm"
                        variant="ghost"
                        color="success"
                        onPress={install}
                        startContent={<Download className="w-4 h-4" />}
                    >
                        Install {state.version}
                    </Button>
                ) : (
                    <Button
                        size="sm"
                        radius="sm"
                        variant="ghost"
                        isDisabled={isBusy}
                        isLoading={isBusy}
                        onPress={check}
                        startContent={!isBusy && <RefreshCw className="w-4 h-4" />}
                    >
                        Check for updates
                    </Button>
                )}
            </div>

            {state.kind === "downloading" && (
                <Progress
                    aria-label="Downloading update"
                    size="sm"
                    value={state.percent}
                    className="max-w-full"
                />
            )}

            {state.kind === "upToDate" && (
                <span className="flex items-center gap-1 text-xs text-success">
                    <Check className="w-4 h-4" />
                    You are on the latest version.
                </span>
            )}

            {state.kind === "ready" && (
                <span className="text-xs text-success">Installed. Restarting…</span>
            )}

            {state.kind === "error" && (
                <span className="flex items-start gap-1 text-xs text-danger break-words">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {state.message}
                </span>
            )}
        </div>
    );
}
