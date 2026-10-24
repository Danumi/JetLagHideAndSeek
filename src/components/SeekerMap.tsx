import { useStore } from "@nanostores/react";
import { EyeIcon } from "lucide-react";
import { useEffect } from "react";
import { toast } from "react-toastify";

import { t, useLanguage } from "@/lib/i18n";
import { askOnThisPhone, seekerMapNotice, seekerMapRole } from "@/lib/liveMap";
import { cn } from "@/lib/utils";

import { Button } from "./ui/button";
import { showActionToast } from "./UndoToast";

/*
 * Connected seekers' phones show the map of the one that asks the
 * questions (liveMap.ts): where questions are asked, a note says so with
 * "Ask on this phone", and the buttons that would change the map are off.
 */

/** Whether this phone shows the map of another seeker's phone. */
export const useWatching = () => useStore(seekerMapRole) === "watching";

const confirmTakeOver = () => {
    if (window.confirm(t("seekerMap.takeOverConfirm"))) askOnThisPhone();
};

/** Buttons and fields that would change the seekers' map: off while watching. */
export const ViewOnly = ({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) => {
    const watching = useWatching();
    return (
        <fieldset
            disabled={watching}
            className={cn("m-0 min-w-0 border-0 p-0", className)}
        >
            {children}
        </fieldset>
    );
};

/** On a phone that shows another one's map: so, and "Ask on this phone". */
export const WatchingNote = ({ className }: { className?: string }) => {
    useLanguage();
    const watching = useWatching();
    if (!watching) return null;

    return (
        <div
            className={cn(
                "flex flex-col gap-2 rounded-lg border-2 border-sky-600 bg-sky-600/10 p-3",
                className,
            )}
        >
            <p className="flex gap-2 text-sm">
                <EyeIcon className="mt-0.5 size-4 shrink-0" />
                {t("seekerMap.watching")}
            </p>
            <Button
                variant="outline"
                className="h-10 self-start"
                onClick={confirmTakeOver}
            >
                {t("seekerMap.takeOver")}
            </Button>
        </div>
    );
};

/** Messages about the seekers' map; once in the app. */
export const SeekerMapNotices = () => {
    useEffect(
        () =>
            seekerMapNotice.listen((value) => {
                switch (value?.notice) {
                    case "blocked":
                        showActionToast(
                            t("seekerMap.blocked"),
                            t("seekerMap.takeOver"),
                            confirmTakeOver,
                            6000,
                        );
                        break;
                    case "watching":
                        toast.info(t("seekerMap.nowWatching"));
                        break;
                    case "lost":
                        toast.warning(t("seekerMap.lost"), {
                            autoClose: 8000,
                        });
                        break;
                    case "asking":
                        toast.success(t("seekerMap.nowAsking"));
                        break;
                }
            }),
        [],
    );
    return null;
};
