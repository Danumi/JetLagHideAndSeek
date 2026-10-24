import { useStore } from "@nanostores/react";
import { FlagIcon, PauseIcon, PlayIcon, TimerIcon, XIcon } from "lucide-react";

import { hiderInbox, hiderMode } from "@/lib/context";
import { t, useLanguage } from "@/lib/i18n";
import { hiderLate, lateAnswersFor, liveGame } from "@/lib/live";
import { cn } from "@/lib/utils";
import { clockTime } from "@/maps/deadline";
import {
    deletePastRound,
    endHidingPeriod,
    formatDuration,
    foundHider,
    gameClock,
    gameClockState,
    HIDING_PERIOD_MINUTES,
    notFoundYet,
    pastRounds,
    pauseForLateAnswers,
    pauseGameClock,
    resumeGameClock,
    startGameClock,
    undoEndHidingPeriod,
} from "@/maps/gameClock";

import { useNow } from "./AnswerClock";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { showUndoToast } from "./UndoToast";

/*
 * The time of the round: "Start timer" when the hiding period begins, then
 * the hiding time until "Found". In full on the hider screen, as a small
 * clock on the map that opens the same card.
 */

/**
 * When late answers stopped the hiding time: on the hider's phone, which
 * knows when the answers went out, and on the phones connected to it.
 */
const useLateAnswers = (now: number) =>
    lateAnswersFor(
        {
            hider: useStore(hiderMode) !== false,
            connected: useStore(liveGame) !== null,
            pause: useStore(pauseForLateAnswers),
            inbox: useStore(hiderInbox),
            shared: useStore(hiderLate),
        },
        now,
    );

/**
 * Sets the hiding period to 0: the official time is up, or everyone agrees
 * to start. The hiding time counts from now.
 */
export const StartSeekingButton = ({ className }: { className?: string }) => (
    <Button
        variant="outline"
        className={className}
        onClick={() => {
            endHidingPeriod();
            showUndoToast(t("gameClock.endedHiding"), undoEndHidingPeriod);
        }}
    >
        <FlagIcon />
        {t("gameClock.endHiding")}
    </Button>
);

/**
 * The hiding times of the last rounds, newest first. ✕ deletes one round
 * (after asking), "Clear" all of them.
 */
const PastRounds = () => {
    const $pastRounds = useStore(pastRounds);
    if ($pastRounds.length === 0) return null;

    return (
        <div className="flex flex-col gap-1 border-t pt-2">
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("gameClock.rounds")}
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-muted-foreground"
                    onClick={() => {
                        if (window.confirm(t("gameClock.clearRoundsConfirm"))) {
                            pastRounds.set([]);
                        }
                    }}
                >
                    {t("gameClock.clearRounds")}
                </Button>
            </div>
            {[...$pastRounds].reverse().map((round) => (
                <div
                    key={round.number}
                    className="flex items-baseline justify-between gap-2 text-sm"
                >
                    <span>
                        {t("gameClock.round", { number: round.number })}
                        <span className="text-muted-foreground">
                            {" "}
                            · {clockTime(round.endedAt)}
                            {!round.found &&
                                ` · ${t("gameClock.notMarkedFound")}`}
                        </span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="font-semibold tabular-nums">
                            {formatDuration(round.hidingTime)}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground"
                            aria-label={t("gameClock.deleteRound", {
                                number: round.number,
                            })}
                            title={t("gameClock.deleteRound", {
                                number: round.number,
                            })}
                            onClick={() => {
                                if (
                                    window.confirm(
                                        t("gameClock.deleteRoundConfirm", {
                                            number: round.number,
                                            time: formatDuration(
                                                round.hidingTime,
                                            ),
                                        }),
                                    )
                                ) {
                                    deletePastRound(round.number);
                                }
                            }}
                        >
                            <XIcon className="!size-4" />
                        </Button>
                    </span>
                </div>
            ))}
        </div>
    );
};

/** Start, pause and stop the game timer, with what it shows. */
export const GameClockCard = ({ className }: { className?: string }) => {
    useLanguage();
    const $clock = useStore(gameClock);
    const $pauseForLateAnswers = useStore(pauseForLateAnswers);
    // Only the hider's phone knows when answers came late: theirs counts,
    // and connected phones take it from there
    const seeker = useStore(hiderMode) === false;
    const connected = useStore(liveGame) !== null;
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
                <PastRounds />
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
                    <StartSeekingButton className="h-11" />
                    <p className="text-xs text-muted-foreground">
                        {t("gameClock.endHidingHint")}
                    </p>
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
                        {seeker
                            ? connected
                                ? t("gameClock.seekersHintLive")
                                : t("gameClock.seekersHint")
                            : $pauseForLateAnswers
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
                        {seeker &&
                            !connected &&
                            ` ${t("gameClock.hiderCounts")}`}
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
            <PastRounds />
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
