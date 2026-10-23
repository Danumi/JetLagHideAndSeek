import { useStore } from "@nanostores/react";
import { PauseIcon, PlayIcon, TimerIcon } from "lucide-react";

import { hiderInbox } from "@/lib/context";
import { t, useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { clockTime } from "@/maps/deadline";
import {
    formatDuration,
    foundHider,
    gameClock,
    gameClockState,
    HIDING_PERIOD_MINUTES,
    notFoundYet,
    pauseForLateAnswers,
    pauseGameClock,
    resumeGameClock,
    startGameClock,
} from "@/maps/gameClock";
import { lateIntervals } from "@/maps/hiderLog";

import { useNow } from "./AnswerClock";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

/*
 * The time of the round: "Start timer" when the hiding period begins, then
 * the hiding time until "Found". In full on the hider screen, as a small
 * clock on the map that opens the same card.
 */

/**
 * When late answers stopped the hiding time: on the hider's phone, which
 * knows when the answers went out.
 */
const useLateAnswers = (now: number) => {
    const $inbox = useStore(hiderInbox);
    const $pauseForLateAnswers = useStore(pauseForLateAnswers);
    return $pauseForLateAnswers ? lateIntervals($inbox, now) : [];
};

/** Start, pause and stop the game timer, with what it shows. */
export const GameClockCard = ({ className }: { className?: string }) => {
    useLanguage();
    const $clock = useStore(gameClock);
    const $pauseForLateAnswers = useStore(pauseForLateAnswers);
    const now = useNow();
    const late = useLateAnswers(now);

    if (!$clock) {
        return (
            <div
                className={cn(
                    "flex flex-col gap-2 rounded-lg border-2 border-blue-600 bg-blue-600/10 p-3",
                    className,
                )}
            >
                <div className="flex items-center gap-2 font-semibold">
                    <TimerIcon className="size-5 shrink-0 text-blue-500" />
                    {t("gameClock.title")}
                </div>
                <p className="text-sm text-muted-foreground">
                    {t("gameClock.startHint", {
                        minutes: HIDING_PERIOD_MINUTES,
                    })}
                </p>
                <Button
                    className="h-12 bg-blue-600 text-base font-semibold text-white hover:bg-blue-700"
                    onClick={() => startGameClock()}
                >
                    <PlayIcon />
                    {t("gameClock.start")}
                </Button>
            </div>
        );
    }

    const state = gameClockState($clock, now, late);
    const reset = (
        <Button
            variant="ghost"
            size="sm"
            className="self-end text-muted-foreground"
            onClick={() => {
                if (window.confirm(t("gameClock.resetConfirm"))) {
                    gameClock.set(null);
                }
            }}
        >
            {t("gameClock.reset")}
        </Button>
    );

    return (
        <div
            className={cn(
                "flex flex-col gap-2 rounded-lg border p-3",
                state.phase === "found" && "border-green-600 bg-green-600/10",
                className,
            )}
        >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TimerIcon className="size-4 shrink-0" />
                {t("gameClock.title")}
            </div>
            {state.phase === "hiding" && (
                <>
                    <div className="text-2xl font-semibold tabular-nums">
                        {t("gameClock.hidingPeriod", {
                            left: formatDuration(state.left + 999),
                        })}
                    </div>
                    <div className="text-sm text-muted-foreground">
                        {t("gameClock.seekersStart", {
                            time: clockTime(state.endsAt),
                        })}
                    </div>
                </>
            )}
            {state.phase === "seeking" && (
                <>
                    <div className="flex items-baseline gap-2">
                        <span className="text-sm">
                            {t("gameClock.hidingTime")}
                        </span>
                        <span
                            className={cn(
                                "text-3xl font-semibold tabular-nums",
                                (state.paused || state.late) &&
                                    "text-muted-foreground",
                            )}
                        >
                            {formatDuration(state.hidingTime)}
                        </span>
                        {(state.paused || state.late) && (
                            <span className="text-sm font-semibold text-orange-400">
                                {state.paused
                                    ? t("gameClock.paused")
                                    : t("gameClock.late")}
                            </span>
                        )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                        {t("gameClock.since", { time: clockTime(state.since) })}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant="outline"
                            className="h-11"
                            onClick={() =>
                                state.paused
                                    ? resumeGameClock()
                                    : pauseGameClock()
                            }
                        >
                            {state.paused ? <PlayIcon /> : <PauseIcon />}
                            {state.paused
                                ? t("gameClock.resume")
                                : t("gameClock.pause")}
                        </Button>
                        <Button
                            className="h-11 bg-green-600 font-semibold text-white hover:bg-green-700"
                            onClick={() => foundHider()}
                        >
                            {t("gameClock.found")}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {$pauseForLateAnswers
                            ? t("gameClock.pauseHintMove")
                            : t("gameClock.pauseHint")}
                    </p>
                </>
            )}
            {state.phase === "found" && (
                <>
                    <div className="text-2xl font-semibold tabular-nums">
                        {t("gameClock.foundAfter", {
                            time: formatDuration(state.hidingTime),
                        })}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {t("gameClock.bonusHint")}
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        className="self-start"
                        onClick={notFoundYet}
                    >
                        {t("gameClock.notFound")}
                    </Button>
                </>
            )}
            {reset}
        </div>
    );
};

/** The game timer at the top of the map; tapping it opens the card. */
export const GameClockChip = () => {
    useLanguage();
    const $clock = useStore(gameClock);
    const now = useNow();
    const late = useLateAnswers(now);
    const state = $clock && gameClockState($clock, now, late);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className="flex w-fit items-center gap-1.5 rounded-full border bg-background/95 px-3 py-1.5 text-sm tabular-nums text-foreground shadow-lg">
                    {!state ? (
                        <>
                            <PlayIcon className="size-4 shrink-0 text-blue-500" />
                            {t("gameClock.start")}
                        </>
                    ) : (
                        <>
                            {state.phase === "seeking" &&
                            (state.paused || state.late) ? (
                                <PauseIcon className="size-4 shrink-0 text-orange-400" />
                            ) : (
                                <TimerIcon
                                    className={cn(
                                        "size-4 shrink-0",
                                        state.phase === "found"
                                            ? "text-green-500"
                                            : "text-muted-foreground",
                                    )}
                                />
                            )}
                            {state.phase === "hiding"
                                ? t("gameClock.chipHiding", {
                                      left: formatDuration(state.left + 999),
                                  })
                                : formatDuration(state.hidingTime)}
                        </>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent
                side="bottom"
                align="start"
                className="w-[min(20rem,calc(100vw-1.5rem))] p-0"
            >
                <GameClockCard className="border-0 bg-transparent" />
            </PopoverContent>
        </Popover>
    );
};
