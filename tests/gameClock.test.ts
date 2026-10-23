import { beforeEach, describe, expect, it } from "vitest";

import {
    formatDuration,
    foundHider,
    gameClock,
    gameClockState,
    HIDING_PERIOD_MINUTES,
    notFoundYet,
    pauseGameClock,
    resumeGameClock,
    startGameClock,
} from "@/maps/gameClock";

const T0 = Date.UTC(2026, 9, 23, 12, 0);
const MIN = 60_000;
const SEEKING = T0 + HIDING_PERIOD_MINUTES * MIN;

describe("the game timer", () => {
    beforeEach(() => gameClock.set(null));

    it("counts down the 30 minute hiding period first (Small)", () => {
        expect(HIDING_PERIOD_MINUTES).toBe(30);
        startGameClock(T0);
        expect(gameClockState(gameClock.get()!, T0 + 10 * MIN)).toEqual({
            phase: "hiding",
            left: 20 * MIN,
            endsAt: SEEKING,
        });
    });

    it("then counts the hiding time until the hider is found", () => {
        startGameClock(T0);
        expect(gameClockState(gameClock.get()!, SEEKING + 42 * MIN)).toEqual({
            phase: "seeking",
            hidingTime: 42 * MIN,
            since: SEEKING,
            paused: false,
        });
        foundHider(SEEKING + 50 * MIN);
        expect(gameClockState(gameClock.get()!, SEEKING + 99 * MIN)).toEqual({
            phase: "found",
            hidingTime: 50 * MIN,
        });
    });

    it("leaves out the time it was paused", () => {
        startGameClock(T0);
        pauseGameClock(SEEKING + 10 * MIN);
        expect(
            gameClockState(gameClock.get()!, SEEKING + 15 * MIN),
        ).toMatchObject({ hidingTime: 10 * MIN, paused: true });
        resumeGameClock(SEEKING + 20 * MIN);
        expect(
            gameClockState(gameClock.get()!, SEEKING + 30 * MIN),
        ).toMatchObject({ hidingTime: 20 * MIN, paused: false });
        // Found while paused: the pause doesn't count either
        pauseGameClock(SEEKING + 40 * MIN);
        foundHider(SEEKING + 45 * MIN);
        expect(gameClockState(gameClock.get()!)).toEqual({
            phase: "found",
            hidingTime: 30 * MIN,
        });
    });

    it("runs on after 'Found' by mistake", () => {
        startGameClock(T0);
        foundHider(SEEKING + 5 * MIN);
        notFoundYet();
        expect(
            gameClockState(gameClock.get()!, SEEKING + 8 * MIN),
        ).toMatchObject({ phase: "seeking", hidingTime: 8 * MIN });
    });

    it("writes hours, minutes and seconds", () => {
        expect(formatDuration(0)).toBe("0:00");
        expect(formatDuration(23 * MIN + 45_000)).toBe("23:45");
        expect(formatDuration(83 * MIN + 45_000)).toBe("1:23:45");
    });
});
