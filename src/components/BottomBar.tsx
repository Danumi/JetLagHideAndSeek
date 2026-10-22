import { useStore } from "@nanostores/react";
import { ListIcon, MapIcon, VenetianMaskIcon } from "lucide-react";

import { SidebarContext } from "@/components/ui/sidebar-l";
import {
    hiderMode,
    hiderScreenOpen,
    questions,
    thermometerRun,
    zoneSheetOpen,
} from "@/lib/context";
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

/**
 * The three big buttons below the map: the questions asked so far, a new
 * question, the hiding zones (the hider: back to the hider screen, the
 * hiding zones). Above them, the running thermometer and the reminder of
 * questions waiting for an answer.
 */
export const BottomBar = () => {
    const $questions = useStore(questions);
    const $thermometerRun = useStore(thermometerRun);
    const $hiderMode = useStore(hiderMode);
    const anyPending = $questions.some(isPending);

    return (
        <div className="relative z-[1030] shrink-0">
            {$hiderMode === false && (
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
                            label="Questions"
                            badge={$questions.length}
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
                            Hider mode
                        </Button>
                    )}
                    <SideButton
                        icon={<MapIcon />}
                        label="Zones"
                        onClick={() => zoneSheetOpen.set(true)}
                    />
                </div>
            </nav>
        </div>
    );
};
