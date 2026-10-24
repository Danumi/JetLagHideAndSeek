import { describe, expect, it } from "vitest";

import type { HiderInboxEntry } from "@/lib/context";
import {
    applyChange,
    clockStep,
    createLiveGame,
    databaseAddress,
    gameKeys,
    joinLiveGame,
    lateAnswersFor,
    leaveLiveGame,
    liveAddress,
    liveGame,
    liveLink,
    newGameKeepsClock,
    POSITION_EVERY_MS,
    positionDue,
    readLiveLink,
    seal,
    unseal,
} from "@/lib/live";
import { gameClock } from "@/maps/gameClock";
import { lateRanges, lateUntil } from "@/maps/hiderLog";

const APP = "https://danumi.github.io/JetLagHideAndSeek/";
// Made up: never a real database in the repo
const DATABASE =
    "https://example-game-default-rtdb.europe-west1.firebasedatabase.app";
const GAME = { address: DATABASE, secret: "abcdefghijklmnopqrstuv" };

const T0 = new Date(2026, 9, 24, 14, 0, 0).getTime();

describe("connection link", () => {
    it("carries the database and the secret after the #", () => {
        const link = liveLink(GAME, `${APP}?ask=abc`);
        const url = new URL(link);
        expect(url.origin + url.pathname).toBe(APP);
        expect(url.search).toBe("");
        expect(url.hash).toMatch(/^#live=[A-Za-z0-9_-]+$/);
        expect(link).not.toContain("example-game");
        expect(readLiveLink(link)).toEqual(GAME);
    });

    it("is found in a whole chat message", () => {
        const link = liveLink(GAME, APP);
        expect(readLiveLink(`Join us: ${link} see you`)).toEqual(GAME);
    });

    it("ignores anything else", () => {
        expect(readLiveLink(APP)).toBeNull();
        expect(readLiveLink(`${APP}#live=nonsense`)).toBeNull();
        const insecure = liveLink(
            { address: "http://example.test", secret: GAME.secret },
            APP,
        );
        expect(readLiveLink(insecure)).toBeNull();
        const shortSecret = liveLink({ address: DATABASE, secret: "x" }, APP);
        expect(readLiveLink(shortSecret)).toBeNull();
    });

    it("takes the database's address as pasted", () => {
        expect(databaseAddress(` ${DATABASE}/ `)).toBe(DATABASE);
        expect(databaseAddress(DATABASE)).toBe(DATABASE);
        expect(databaseAddress("example-game.firebasedatabase.app")).toBe("");
        expect(databaseAddress("http://example.test")).toBe("");
        expect(databaseAddress("")).toBe("");
    });
});

describe("joining a game", () => {
    it("needs a database to start one", () => {
        leaveLiveGame();
        liveAddress.set("");
        expect(createLiveGame()).toBeNull();
        liveAddress.set(`${DATABASE}/`);
        const game = createLiveGame();
        expect(game?.address).toBe(DATABASE);
        expect(game?.secret).toMatch(/^[A-Za-z0-9_-]{16,}$/);
        expect(liveGame.get()).toEqual(game);
    });

    it("joins a link's game once, and keeps its database", () => {
        leaveLiveGame();
        liveAddress.set("");
        expect(joinLiveGame(GAME)).toBe(true);
        expect(joinLiveGame(GAME)).toBe(false);
        expect(liveAddress.get()).toBe(DATABASE);
        leaveLiveGame();
        expect(liveGame.get()).toBeNull();
    });
});

describe("encryption", () => {
    it("names the game by its secret, without giving the secret away", async () => {
        const keys = await gameKeys(GAME.secret);
        expect(keys.name).toMatch(/^[0-9a-f]{32}$/);
        expect(keys.name).not.toContain(GAME.secret);
        expect((await gameKeys(GAME.secret)).name).toBe(keys.name);
        expect((await gameKeys(`${GAME.secret}x`)).name).not.toBe(keys.name);
    });

    it("only opens with the game's key", async () => {
        const { key } = await gameKeys(GAME.secret);
        const { key: other } = await gameKeys("another-secret-of-a-game");
        const value = { lat: 48.2, lng: 16.37, sentAt: T0 };
        const text = await seal(key, value);
        expect(text).not.toContain("48.2");
        expect(await unseal(key, text)).toEqual(value);
        expect(await unseal(other, text)).toBeUndefined();
        expect(await unseal(key, `${text.slice(0, -2)}AA`)).toBeUndefined();
        expect(await unseal(key, 42)).toBeUndefined();
        expect(await unseal(key, "")).toBeUndefined();
    });
});

describe("the database's stream", () => {
    it("starts with the whole game and keeps only the app's items", () => {
        expect(applyChange({}, "put", "/", null)).toEqual({});
        expect(
            applyChange({ pos: { a: "x" } }, "put", "/", {
                clock: { state: "s", junk: 3 },
                pos: { a: "1", b: "2" },
                other: "y",
            }),
        ).toEqual({
            clock: { state: "s" },
            pos: { a: "1", b: "2" },
            other: {},
        });
    });

    it("changes, adds and removes items", () => {
        const start = { clock: { state: "s" }, pos: { a: "1" } };
        expect(applyChange(start, "put", "/pos/b", "2")).toEqual({
            clock: { state: "s" },
            pos: { a: "1", b: "2" },
        });
        expect(applyChange(start, "put", "/pos/a", null)).toEqual({
            clock: { state: "s" },
            pos: {},
        });
        expect(applyChange(start, "put", "/clock", { late: "l" })).toEqual({
            clock: { late: "l" },
            pos: { a: "1" },
        });
        expect(applyChange(start, "put", "/pos", null)).toEqual({
            clock: { state: "s" },
        });
        expect(applyChange(start, "patch", "/pos", { a: "3", b: "4" })).toEqual(
            { clock: { state: "s" }, pos: { a: "3", b: "4" } },
        );
        expect(applyChange(start, "put", "/pos/a/deeper", "z")).toEqual(start);
    });
});

describe("game timer", () => {
    it("takes the newer timer, from whichever phone", () => {
        expect(clockStep(undefined, 0)).toBe("send");
        expect(clockStep(T0, T0 + 1)).toBe("send");
        expect(clockStep(T0 + 1, T0)).toBe("take");
        // A phone that just joined takes the game's timer
        expect(clockStep(T0, 0)).toBe("take");
        expect(clockStep(T0, T0)).toBe("keep");
    });

    it("keeps a hiding period that has just begun on New Game", () => {
        const now = T0 + 10 * 60_000;
        gameClock.set({ startedAt: T0, pausedMs: 0 });
        leaveLiveGame();
        // Not connected: New Game ends the round as before
        expect(newGameKeepsClock(now)).toBe(false);
        joinLiveGame(GAME);
        // Connected, 10 minutes into the hiding period: the phone joins the round
        expect(newGameKeepsClock(now)).toBe(true);
        // Seeking already: New Game starts the next round on all phones
        expect(newGameKeepsClock(T0 + 40 * 60_000)).toBe(false);
        gameClock.set(null);
        expect(newGameKeepsClock(now)).toBe(false);
        leaveLiveGame();
    });

    const entry = (
        key: number,
        askedAt: number,
        answeredAt?: number,
    ): HiderInboxEntry => ({
        key,
        askedAt,
        receivedAt: askedAt,
        answeredAt,
    });
    // Due after 5 minutes: answered 3 minutes late, in time, still open
    const inbox = [
        entry(1, T0, T0 + 8 * 60_000),
        entry(2, T0 + 10 * 60_000, T0 + 12 * 60_000),
        entry(3, T0 + 25 * 60_000),
    ];
    const now = T0 + 35 * 60_000;
    const late = [
        { from: T0 + 5 * 60_000, to: T0 + 8 * 60_000 },
        { from: T0 + 30 * 60_000, to: now },
    ];

    it("stops for late answers on the hider's phone", () => {
        expect(
            lateAnswersFor(
                {
                    hider: true,
                    connected: true,
                    pause: true,
                    inbox,
                    shared: [],
                },
                now,
            ),
        ).toEqual(late);
        expect(
            lateAnswersFor(
                {
                    hider: true,
                    connected: true,
                    pause: false,
                    inbox,
                    shared: [],
                },
                now,
            ),
        ).toEqual([]);
    });

    it("stops for late answers on connected seekers' phones too", () => {
        const shared = lateRanges(inbox);
        // Still open: late until now on the seeker's phone as well
        expect(shared[2]).toEqual({ from: T0 + 30 * 60_000 });
        expect(lateUntil(JSON.parse(JSON.stringify(shared)), now)).toEqual(
            late,
        );
        expect(
            lateAnswersFor(
                {
                    hider: false,
                    connected: true,
                    pause: true,
                    inbox: [],
                    shared,
                },
                now,
            ),
        ).toEqual(late);
        // Not connected: a seeker's phone doesn't know
        expect(
            lateAnswersFor(
                {
                    hider: false,
                    connected: false,
                    pause: true,
                    inbox: [],
                    shared,
                },
                now,
            ),
        ).toEqual([]);
    });
});

describe("seekers' positions", () => {
    const at = { lat: 48.2, lng: 16.37 };
    const sent = { ...at, accuracy: 10, at: T0, sentAt: T0 };

    it("go out right away, then every 30 seconds", () => {
        expect(positionDue(null, at, T0)).toBe(true);
        expect(positionDue(sent, at, T0 + 10_000)).toBe(false);
        expect(positionDue(sent, at, T0 + POSITION_EVERY_MS)).toBe(true);
    });

    it("go out sooner after moving, but not all the time", () => {
        // About 55 m north
        const moved = { lat: 48.2005, lng: 16.37 };
        expect(positionDue(sent, moved, T0 + 2_000)).toBe(false);
        expect(positionDue(sent, moved, T0 + 6_000)).toBe(true);
        // A few meters: GPS jitter
        expect(
            positionDue(sent, { lat: 48.20005, lng: 16.37 }, T0 + 6_000),
        ).toBe(false);
    });
});
