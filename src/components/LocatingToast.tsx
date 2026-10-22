import { type Id, toast } from "react-toastify";

import { t } from "@/lib/i18n";

/** "Getting your location · ±80 m" with "Use anyway" once there is a position. */
const LocatingMessage = ({
    accuracy,
    onUseAnyway,
}: {
    accuracy?: number;
    onUseAnyway: () => void;
}) => (
    <div className="flex items-center justify-between gap-3">
        <span>
            {accuracy === undefined
                ? t("locating.waiting")
                : t("locating.accuracy", { meters: Math.round(accuracy) })}
        </span>
        {accuracy !== undefined && (
            <button
                className="shrink-0 rounded-md bg-blue-600 px-3 py-1 font-semibold text-white"
                onClick={onUseAnyway}
            >
                {t("locating.useAnyway")}
            </button>
        )}
    </div>
);

/**
 * Shows (or, with its id, updates) the message while the app waits for a
 * precise position. Returns the id of the message.
 */
export const showLocatingToast = (
    accuracy: number | undefined,
    onUseAnyway: () => void,
    toastId?: Id,
): Id => {
    const render = (
        <LocatingMessage accuracy={accuracy} onUseAnyway={onUseAnyway} />
    );
    if (toastId === undefined) return toast.loading(render);
    toast.update(toastId, { render });
    return toastId;
};
