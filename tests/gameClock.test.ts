import { beforeEach, describe, expect, it } from "vitest";

import {
    deletePastRound,
    endHidingPeriod,
    endRound,
    formatDuration,
    foundHider,
    gameClock,
    gameClockState,
    HIDING_PERIOD_MINUTES,
    notFoundYet,
    pastRounds,
    pauseGameClock,
    resumeGameClock,
    startGameClock,
    undoEndHidingPeriod,
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
            late: false,
        });
        foundHider(SEEKING + 50 * MIN);
        expect(gameClockState(gameClock.get()!, SEEKING + 99 * MIN)).toEqual({
            phase: "found",
            hidingTime: 50 * MIN,
        });
    });

    it("ends the hiding period by hand: 'Start seeking now'", () => {
        startGameClock(T0);
        endHidingPeriod(T0 + 12 * MIN);
        expect(gameClockState(gameClock.get()!, T0 + 20 * MIN)).toEqual({
            phase: "seeking",
            hidingTime: 8 * MIN,
            since: T0 + 12 * MIN,
            paused: false,
            late: false,
        });

        // Once over, it stays over
        endHidingPeriod(SEEKING + 5 * MIN);
        expect(gameClock.get()!.hidingEndedAt).toBe(T0 + 12 * MIN);

        undoEndHidingPeriod();
        expect(gameClockState(gameClock.get()!, T0 + 20 * MIN).phase).toBe(
            "hiding",
        );
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

    it("stands still while answers are late", () => {
        startGameClock(T0);
        // Due 10 minutes in, sent 4 minutes late; another one late from
        // 12 minutes in, overlapping, still open
        const late = [
            { from: SEEKING + 10 * MIN, to: SEEKING + 14 * MIN },
            { from: SEEKING + 12 * MIN, to: SEEKING + 20 * MIN },
        ];
        expect(
            gameClockState(gameClock.get()!, SEEKING + 20 * MIN, late),
        ).toMatchObject({ hidingTime: 10 * MIN, late: true });
        expect(
            gameClockState(gameClock.get()!, SEEKING + 30 * MIN, late),
        ).toMatchObject({ hidingTime: 20 * MIN, late: false });
        // Late before the hiding period ended: doesn't count
        expect(
            gameClockState(gameClock.get()!, SEEKING + 5 * MIN, [
                { from: SEEKING - 10 * MIN, to: SEEKING + 2 * MIN },
            ]),
        ).toMatchObject({ hidingTime: 3 * MIN });
        // Paused by hand meanwhile: that time counts only once
        pauseGameClock(SEEKING + 11 * MIN);
        expect(
            gameClockState(gameClock.get()!, SEEKING + 30 * MIN, late),
        ).toMatchObject({ hidingTime: 10 * MIN, paused: true, late: false });
    });

    it("keeps the hiding time of past rounds", () => {
        pastRounds.set([]);
        startGameClock(T0);
        foundHider(SEEKING + 50 * MIN);
        endRound(SEEKING + 60 * MIN);
        expect(gameClock.get()).toBeNull();

        // Ended during the hiding period: no round to keep
        startGameClock(T0 + 100 * MIN);
        endRound(T0 + 110 * MIN);

        // Not stopped with "Found", and a late answer
        startGameClock(T0 + 200 * MIN);
        endRound(T0 + 200 * MIN + 30 * MIN + 20 * MIN, [
            {
                from: T0 + 200 * MIN + 35 * MIN,
                to: T0 + 200 * MIN + 40 * MIN,
            },
        ]);

        expect(pastRounds.get()).toEqual([
            {
                number: 1,
                endedAt: SEEKING + 50 * MIN,
                hidingTime: 50 * MIN,
                found: true,
            },
            {
                number: 2,
                endedAt: T0 + 250 * MIN,
                hidingTime: 15 * MIN,
                found: false,
            },
        ]);
    });

    it("deletes a single past round, the others keep their numbers", () => {
        pastRounds.set([]);
        for (const start of [T0, T0 + 100 * MIN, T0 + 200 * MIN]) {
            startGameClock(start);
            endRound(start + 40 * MIN);
        }
        expect(pastRounds.get().map((round) => round.number)).toEqual([
            1, 2, 3,
        ]);

        deletePastRound(2);
        expect(pastRounds.get().map((round) => round.number)).toEqual([1, 3]);

        // The next round still counts on from the last one in the list
        startGameClock(T0 + 300 * MIN);
        endRound(T0 + 340 * MIN);
        deletePastRound(4);
        startGameClock(T0 + 400 * MIN);
        endRound(T0 + 440 * MIN);
        expect(pastRounds.get().map((round) => round.number)).toEqual([
            1, 3, 4,
        ]);

        // Not in the list: nothing changes
        deletePastRound(7);
        expect(pastRounds.get()).toHaveLength(3);
    });

    it("writes hours, minutes and seconds", () => {
        expect(formatDuration(0)).toBe("0:00");
        expect(formatDuration(23 * MIN + 45_000)).toBe("23:45");
        expect(formatDuration(83 * MIN + 45_000)).toBe("1:23:45");
    });
});
