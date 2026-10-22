import { useStore } from "@nanostores/react";
import {
    ListIcon,
    MapIcon,
    MousePointerClickIcon,
    VenetianMaskIcon,
} from "lucide-react";

import { SidebarContext } from "@/components/ui/sidebar-l";
import {
    hiderMode,
    hiderScreenOpen,
    photoQuestions,
    pickingLocation,
    type PickTarget,
    questions,
    thermometerRun,
    zoneSheetOpen,
} from "@/lib/context";
import { cancelPickOnMap } from "@/lib/gps";
import { t, useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { isPending } from "@/maps/answers";

import {
    AskQuestionDrawer,
    ThermometerTracker,
    WaitingForAnswer,
} from "./AskQuestion";
import { Button } from "./ui/button";

const SideButton = ({
    icon,
    label,
    badge,
    alert,
    onClick,
    ...props
}: {
    icon: React.ReactNode;
    label: string;
    badge?: number;
    alert?: boolean;
    onClick: () => void;
} & React.HTMLAttributes<HTMLButtonElement>) => (
    <Button
        variant="ghost"
        className="relative h-14 flex-1 flex-col gap-0.5 rounded-xl px-1 text-xs font-semibold [&_svg]:size-6"
        onClick={onClick}
        {...props}
    >
        {icon}
        {label}
        {!!badge && (
            <span
                className={cn(
                    "absolute right-[calc(50%-1.6rem)] top-1 min-w-5 rounded-full px-1 text-[11px] leading-5 text-white",
                    alert ? "bg-orange-500" : "bg-blue-600",
                )}
            >
                {badge}
            </span>
        )}
    </Button>
);

const pickText = (target: PickTarget) => {
    if (target.questionKey === -1) return t("pick.hiding");
    if (target.point === "start") return t("pick.start");
    if (target.point === "end") return t("pick.end");
    return t("pick.question");
};

/** "Pick on map" is on: what to tap, and "Cancel". */
const PickOnMapHint = ({ target }: { target: PickTarget }) => (
    <div className="flex max-w-[92vw] items-center gap-2 rounded-2xl bg-blue-600 py-1 pl-4 pr-1 text-sm font-semibold leading-tight text-white shadow-lg">
        <MousePointerClickIcon className="h-4 w-4 shrink-0" />
        <span className="min-w-0">{pickText(target)}</span>
        <Button
            size="sm"
            variant="secondary"
            className="h-8 shrink-0 rounded-full"
            onClick={cancelPickOnMap}
        >
            {t("common.cancel")}
        </Button>
    </div>
);

/**
 * The three big buttons below the map: the questions asked so far, a new
 * question, the hiding zones (the hider: back to the hider screen, the
 * hiding zones). Above them, the running thermometer and the reminder of
 * questions waiting for an answer.
 */
export const BottomBar = () => {
    useLanguage();
    const $questions = useStore(questions);
    const $photoQuestions = useStore(photoQuestions);
    const $thermometerRun = useStore(thermometerRun);
    const $hiderMode = useStore(hiderMode);
    const $pickingLocation = useStore(pickingLocation);
    const anyPending =
        $questions.some(isPending) ||
        $photoQuestions.some((photo) => photo.status === "pending");

    return (
        <div className="relative z-[1030] shrink-0">
            {$pickingLocation && (
                <div className="pointer-events-none absolute bottom-full left-0 right-0 mb-3 flex flex-col items-center gap-2 px-2 [&>*]:pointer-events-auto">
                    <PickOnMapHint target={$pickingLocation} />
                </div>
            )}
            {$hiderMode === false && !$pickingLocation && (
                <div className="pointer-events-none absolute bottom-full left-0 right-0 mb-3 flex flex-col items-center gap-2 px-2 [&>*]:pointer-events-auto">
                    <WaitingForAnswer />
                    {$thermometerRun && (
                        <ThermometerTracker run={$thermometerRun} />
                    )}
                </div>
            )}
            <nav className="flex justify-center border-t bg-background px-2 py-2">
                <div className="flex w-full max-w-xl items-center gap-2">
                    {/* The hider's questions are on the hider screen */}
                    {$hiderMode === false && (
                        <SideButton
                            icon={<ListIcon />}
                            label={t("bar.questions")}
                            badge={$questions.length + $photoQuestions.length}
                            alert={anyPending}
                            onClick={() => SidebarContext.get().toggleSidebar()}
                            data-tutorial-id="left-sidebar-trigger"
                        />
                    )}
                    {$hiderMode === false ? (
                        <AskQuestionDrawer className="flex-[1.6]" />
                    ) : (
                        // The hider doesn't ask questions: back to the hider screen
                        <Button
                            className="h-14 flex-[1.6] rounded-xl bg-violet-700 px-4 text-base font-semibold text-white shadow-lg hover:bg-violet-800"
                            onClick={() => hiderScreenOpen.set(true)}
                        >
                            <VenetianMaskIcon className="!size-6" />
                            {t("bar.hiderMode")}
                        </Button>
                    )}
                    <SideButton
                        icon={<MapIcon />}
                        label={t("bar.zones")}
                        onClick={() => zoneSheetOpen.set(true)}
                    />
                </div>
            </nav>
        </div>
    );
};
