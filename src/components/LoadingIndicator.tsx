import { useStore } from "@nanostores/react";
import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { isLoading } from "@/lib/context";
import { t, useLanguage } from "@/lib/i18n";
import { loadingTasks } from "@/lib/loading";
import { preloadProgress } from "@/maps/preload";

/** After this long the indicator also shows how long a download has taken. */
const SHOW_SECONDS_AFTER_MS = 10_000;

/**
 * One small box at the top of the map for everything that is loading: map
 * data from the servers, the map being computed and the data loaded for a new
 * game. It never blocks touches on the map.
 */
export const LoadingIndicator = () => {
    useLanguage();
    const $loadingTasks = useStore(loadingTasks);
    const $isLoading = useStore(isLoading);
    const $preloadProgress = useStore(preloadProgress);
    const [now, setNow] = useState(() => Date.now());
    const [computing, setComputing] = useState(false);

    const downloading = $loadingTasks.length > 0;
    useEffect(() => {
        if (!downloading) return;
        setNow(Date.now());
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [downloading]);

    // Short computations would only make the box flicker
    useEffect(() => {
        if (!$isLoading) {
            setComputing(false);
            return;
        }
        const timer = setTimeout(() => setComputing(true), 400);
        return () => clearTimeout(timer);
    }, [$isLoading]);

    const task = $loadingTasks[0];
    const label = task?.label ?? (computing ? t("loading.updating") : null);
    if (!label && !$preloadProgress) return null;

    const elapsed = task ? now - task.startedAt : 0;

    return (
        // Narrow enough to leave the buttons on both sides free
        <div
            className="pointer-events-none flex w-[min(calc(100vw_-_136px),340px)] flex-col gap-1 rounded-lg border bg-background/95 px-3 py-2 text-sm text-foreground shadow-lg"
            role="status"
        >
            {label && (
                <div className="flex items-center gap-2">
                    <LoaderCircleIcon className="h-4 w-4 shrink-0 animate-spin" />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    {$loadingTasks.length > 1 && (
                        <span className="text-xs text-muted-foreground">
                            +{$loadingTasks.length - 1}
                        </span>
                    )}
                    {elapsed >= SHOW_SECONDS_AFTER_MS && (
                        <span className="text-xs text-muted-foreground">
                            {Math.floor(elapsed / 1000)} s
                        </span>
                    )}
                </div>
            )}
            {$preloadProgress && (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            {$preloadProgress.finished && (
                                <CheckIcon className="h-3 w-3 text-green-500" />
                            )}
                            {$preloadProgress.finished
                                ? t("loading.gameReady")
                                : t("loading.game")}
                        </span>
                        <span>
                            {$preloadProgress.done}/{$preloadProgress.total}
                        </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full bg-blue-600 transition-all"
                            style={{
                                width: `${
                                    $preloadProgress.total > 0
                                        ? (100 * $preloadProgress.done) /
                                          $preloadProgress.total
                                        : 0
                                }%`,
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
