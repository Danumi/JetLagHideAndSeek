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

/** This phone's clock; none until someone starts it. "New Game" resets it. */
export const gameClock = persistentAtom<GameClock | null>("gameClock", null, {
    encode: JSON.stringify,
    decode: JSON.parse,
});

export type GameClockState =
    /** `left`: until the seekers start, at `endsAt`. */
    | { phase: "hiding"; left: number; endsAt: number }
    /** `hidingTime`: since the hiding period ended, without pauses. */
    | {
          phase: "seeking";
          hidingTime: number;
          since: number;
          paused: boolean;
      }
    | { phase: "found"; hidingTime: number };

export const gameClockState = (
    clock: GameClock,
    now = Date.now(),
): GameClockState => {
    const endsAt = clock.startedAt + HIDING_PERIOD_MINUTES * 60_000;
    const stop = clock.foundAt ?? clock.pausedAt ?? now;
    const hidingTime = Math.max(0, stop - endsAt - clock.pausedMs);
    if (clock.foundAt !== undefined) return { phase: "found", hidingTime };
    if (now < endsAt) return { phase: "hiding", left: endsAt - now, endsAt };
    return {
        phase: "seeking",
        hidingTime,
        since: endsAt,
        paused: clock.pausedAt !== undefined,
    };
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
