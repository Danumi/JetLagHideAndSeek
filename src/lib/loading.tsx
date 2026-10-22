import { atom } from "nanostores";
import { toast } from "react-toastify";

export interface LoadingTask {
    id: number;
    /** What is being loaded, e.g. "Finding parks...". */
    label: string;
    startedAt: number;
}

/** Map data being downloaded right now; shown by the loading indicator. */
export const loadingTasks = atom<LoadingTask[]>([]);

let nextTaskId = 0;

/** Shows `label` in the loading indicator until `promise` settles. */
export const trackLoading = async <T,>(
    label: string | undefined,
    promise: Promise<T>,
): Promise<T> => {
    const task = {
        id: nextTaskId++,
        label: label ?? "Loading map data...",
        startedAt: Date.now(),
    };
    loadingTasks.set([...loadingTasks.get(), task]);
    try {
        return await promise;
    } finally {
        loadingTasks.set(loadingTasks.get().filter((t) => t.id !== task.id));
    }
};

/**
 * Bumped by "Retry" after map data failed to load: the map, the hiding zones
 * and an unfinished preload load again.
 */
export const retryTrigger = atom(0);
export const retryLoading = () => retryTrigger.set(retryTrigger.get() + 1);

/** One error message with a "Retry" button, however many requests failed. */
export const showLoadError = (label: string | undefined, reason: string) => {
    const what = (label ?? "Loading map data...").replace(/\.+$/, "");

    toast.error(
        ({ closeToast }) => (
            <div className="flex items-center justify-between gap-3">
                <span>
                    Map data didn&apos;t load ({what}). {reason}
                </span>
                <button
                    className="shrink-0 rounded-md bg-blue-600 px-3 py-1 font-semibold text-white"
                    onClick={() => {
                        closeToast();
                        retryLoading();
                    }}
                >
                    Retry
                </button>
            </div>
        ),
        { toastId: "overpass-error", autoClose: false, closeOnClick: false },
    );
};
