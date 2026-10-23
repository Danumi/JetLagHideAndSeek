import { persistentAtom } from "@nanostores/persistent";

/*
 * The time of a round, which decides who wins: the hiding period (30 minutes
 * in a Small game) for the hider to reach their zone, then the hiding time
 * until the seekers find them. Paused while it doesn't count (a late answer,
 * the Move card). Each phone keeps its own.
 */

export const HIDING_PERIOD_MINUTES = 30;

export type GameClock = {
    /** When the hiding period started, in milliseconds since 1970. */
    startedAt: number;
    /** How long the clock was paused so far, in milliseconds. */
    pausedMs: number;
    /** Since when it is paused. */
    pausedAt?: number;
    /** When the seekers found the hider: the clock stops. */
    foundAt?: number;
};

/**
 * Late answers stop the hiding time by themselves, from when the answer was
 * due until the hider sent it. Off, the hider pauses by hand.
 */
export const pauseForLateAnswers = persistentAtom<boolean>(
    "pauseForLateAnswers",
    true,
    { encode: JSON.stringify, decode: JSON.parse },
);

/** A stretch of time, in milliseconds since 1970. */
export type Interval = { from: number; to: number };

/** How much of `start` to `end` the intervals cover, overlaps once. */
export const coveredMs = (
    intervals: Interval[],
    start: number,
    end: number,
) => {
    const clipped = intervals
        .map(({ from, to }) => ({
            from: Math.max(from, start),
            to: Math.min(to, end),
        }))
        .filter(({ from, to }) => to > from)
        .sort((a, b) => a.from - b.from);
    let total = 0;
    let reached = -Infinity;
    for (const { from, to } of clipped) {
        const begin = Math.max(from, reached);
        if (to > begin) {
            total += to - begin;
            reached = to;
        }
    }
    return total;
};

/** This phone's clock; none until someone starts it. "New Game" resets it. */
export const gameClock = persistentAtom<GameClock | null>("gameClock", null, {
    encode: JSON.stringify,
    decode: JSON.parse,
});

export type GameClockState =
    /** `left`: until the seekers start, at `endsAt`. */
    | { phase: "hiding"; left: number; endsAt: number }
    /**
     * `hidingTime`: since the hiding period ended, without pauses.
     * `late`: stopped for now because an answer is late.
     */
    | {
          phase: "seeking";
          hidingTime: number;
          since: number;
          paused: boolean;
          late: boolean;
      }
    | { phase: "found"; hidingTime: number };

/**
 * What the clock shows. `late`: when answers were late (see
 * `lateIntervals`), the hiding time stands still.
 */
export const gameClockState = (
    clock: GameClock,
    now = Date.now(),
    late: Interval[] = [],
): GameClockState => {
    const endsAt = clock.startedAt + HIDING_PERIOD_MINUTES * 60_000;
    const stop = clock.foundAt ?? clock.pausedAt ?? now;
    // Up to `stop`: the pause going on now counts only once
    const hidingTime = Math.max(
        0,
        stop - endsAt - clock.pausedMs - coveredMs(late, endsAt, stop),
    );
    if (clock.foundAt !== undefined) return { phase: "found", hidingTime };
    if (now < endsAt) return { phase: "hiding", left: endsAt - now, endsAt };
    const paused = clock.pausedAt !== undefined;
    return {
        phase: "seeking",
        hidingTime,
        since: endsAt,
        paused,
        late: !paused && late.some(({ from, to }) => from <= now && now <= to),
    };
};

/** A finished round: its hiding time, kept across "New Game". */
export type PastRound = {
    number: number;
    /** When it ended: "Found", else "New Game". */
    endedAt: number;
    hidingTime: number;
    /** Stopped with "Found"; else the time when "New Game" ended it. */
    found: boolean;
};

const MAX_PAST_ROUNDS = 10;

/** The last rounds on this phone, oldest first. */
export const pastRounds = persistentAtom<PastRound[]>("pastRounds", [], {
    encode: JSON.stringify,
    decode: JSON.parse,
});

/**
 * "New Game": the round's hiding time goes into the list of past rounds
 * (not before the hiding period is over), and the clock is cleared.
 */
export const endRound = (now = Date.now(), late: Interval[] = []) => {
    const clock = gameClock.get();
    if (clock) {
        const state = gameClockState(clock, now, late);
        if (state.phase !== "hiding") {
            const rounds = pastRounds.get();
            pastRounds.set(
                [
                    ...rounds,
                    {
                        number: (rounds.at(-1)?.number ?? 0) + 1,
                        endedAt: clock.foundAt ?? now,
                        hidingTime: state.hidingTime,
                        found: state.phase === "found",
                    },
                ].slice(-MAX_PAST_ROUNDS),
            );
        }
    }
    gameClock.set(null);
};

export const startGameClock = (now = Date.now()) =>
    gameClock.set({ startedAt: now, pausedMs: 0 });

const resumed = (clock: GameClock, now: number): GameClock =>
    clock.pausedAt === undefined
        ? clock
        : {
              ...clock,
              pausedMs: clock.pausedMs + Math.max(0, now - clock.pausedAt),
              pausedAt: undefined,
          };

const change = (update: (clock: GameClock) => GameClock) => {
    const clock = gameClock.get();
    if (clock) gameClock.set(update(clock));
};

export const pauseGameClock = (now = Date.now()) =>
    change((clock) =>
        clock.pausedAt !== undefined || clock.foundAt !== undefined
            ? clock
            : { ...clock, pausedAt: now },
    );

export const resumeGameClock = (now = Date.now()) =>
    change((clock) => resumed(clock, now));

/** The seekers found the hider: the hiding time stops. */
export const foundHider = (now = Date.now()) =>
    change((clock) =>
        clock.foundAt !== undefined
            ? clock
            : { ...resumed(clock, now), foundAt: now },
    );

/** Pressed "Found" by mistake: the time runs on as if nothing happened. */
export const notFoundYet = () =>
    change((clock) => ({ ...clock, foundAt: undefined }));

/** "1:23:45", or "23:45" under an hour. */
export const formatDuration = (ms: number) => {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = String(seconds % 60).padStart(2, "0");
    return hours > 0
        ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
        : `${minutes}:${rest}`;
};
