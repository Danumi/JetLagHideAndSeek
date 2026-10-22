import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { myPosition } from "@/lib/context";
import {
    findPrecisePosition,
    replacesPosition,
    watchMyPosition,
} from "@/lib/gps";

type Watcher = {
    onReading: (reading: GeolocationPosition) => void;
    options?: PositionOptions;
};

let watchers: Map<number, Watcher>;
let nextWatchId = 1;
const geolocation = {
    watchPosition: (
        onReading: Watcher["onReading"],
        _onError: unknown,
        options?: PositionOptions,
    ) => {
        const id = nextWatchId++;
        watchers.set(id, { onReading, options });
        return id;
    },
    clearWatch: (id: number) => watchers.delete(id),
};

/** The phone reports a position this precise (meters) to every watch. */
const report = (accuracy: number, lat = 48.2006) =>
    [...watchers.values()].forEach((watcher) =>
        watcher.onReading({
            coords: { latitude: lat, longitude: 16.3699, accuracy },
            timestamp: Date.now(),
        } as GeolocationPosition),
    );

const page = Object.assign(new EventTarget(), {
    visibilityState: "visible",
});

let clock = Date.UTC(2026, 9, 22, 12);

beforeEach(() => {
    vi.useFakeTimers();
    // Later than any earlier test, which may have come back to the app
    clock += 3_600_000;
    vi.setSystemTime(clock);
    watchers = new Map();
    vi.stubGlobal("navigator", { geolocation });
    vi.stubGlobal("document", page);
    myPosition.set(null);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("replacesPosition", () => {
    const at = 1_000_000;

    it("takes any reading without a known position", () => {
        expect(replacesPosition(null, { accuracy: 500, at })).toBe(true);
    });

    it("takes readings about as precise as the known one", () => {
        const known = { accuracy: 10, at };
        expect(replacesPosition(known, { accuracy: 25, at: at + 1000 })).toBe(
            true,
        );
        expect(
            replacesPosition(
                { accuracy: 40, at },
                { accuracy: 70, at: at + 1000 },
            ),
        ).toBe(true);
    });

    it("keeps a recent precise position over a much worse reading", () => {
        const known = { accuracy: 10, at };
        expect(replacesPosition(known, { accuracy: 80, at: at + 3000 })).toBe(
            false,
        );
    });

    it("takes the worse reading once the precise one is a few seconds old", () => {
        const known = { accuracy: 10, at };
        expect(replacesPosition(known, { accuracy: 80, at: at + 10_000 })).toBe(
            true,
        );
    });
});

describe("the blue dot", () => {
    it("doesn't jump to a much less precise reading", () => {
        const stop = watchMyPosition();
        report(8);
        vi.advanceTimersByTime(2000);
        report(150, 48.21);
        expect(myPosition.get()?.accuracy).toBe(8);

        vi.advanceTimersByTime(10_000);
        report(150, 48.21);
        expect(myPosition.get()?.accuracy).toBe(150);
        stop();
        expect(watchers.size).toBe(0);
    });

    it("starts over with fresh readings when you come back to the app", () => {
        const stop = watchMyPosition();
        const [first] = watchers.keys();
        report(8);

        // The phone was locked for a few seconds
        vi.advanceTimersByTime(5000);
        page.dispatchEvent(new Event("visibilitychange"));
        expect(watchers.has(first)).toBe(false);
        expect(watchers.size).toBe(1);
        expect([...watchers.values()][0].options?.maximumAge).toBe(0);

        // What the phone had before is old now, also when it was precise
        vi.advanceTimersByTime(1000);
        report(60, 48.21);
        expect(myPosition.get()?.accuracy).toBe(60);
        stop();
    });
});

describe("findPrecisePosition", () => {
    it("takes a precise blue dot from the last seconds right away", async () => {
        myPosition.set({ lat: 48.2, lng: 16.37, accuracy: 12, at: clock });
        vi.advanceTimersByTime(3000);
        const search = findPrecisePosition(() => {});
        expect((await search.position)?.accuracy).toBe(12);
        expect(watchers.size).toBe(0);
    });

    it("asks again when the precise blue dot is older", async () => {
        myPosition.set({ lat: 48.2, lng: 16.37, accuracy: 12, at: clock });
        vi.advanceTimersByTime(8000);
        const progress: (number | undefined)[] = [];
        const search = findPrecisePosition((best) =>
            progress.push(best?.accuracy),
        );
        expect(watchers.size).toBe(1);
        report(14);
        expect((await search.position)?.accuracy).toBe(14);
        expect(progress).toEqual([12, 14]);
    });

    it("takes that blue dot when the phone sends nothing new", async () => {
        myPosition.set({ lat: 48.2, lng: 16.37, accuracy: 12, at: clock });
        vi.advanceTimersByTime(8000);
        const search = findPrecisePosition(() => {});
        vi.advanceTimersByTime(2000);
        expect((await search.position)?.accuracy).toBe(12);
        expect(watchers.size).toBe(0);
    });

    it("waits for a position within 30 m and shows the progress", async () => {
        const progress: (number | undefined)[] = [];
        const search = findPrecisePosition((best) =>
            progress.push(best?.accuracy),
        );
        expect(watchers.size).toBe(1);
        expect([...watchers.values()][0].options?.maximumAge).toBe(0);

        report(80);
        report(120);
        report(20);
        expect((await search.position)?.accuracy).toBe(20);
        expect(progress).toEqual([undefined, 80, 20]);
        expect(watchers.size).toBe(0);
    });

    it("takes the most precise position after 10 seconds", async () => {
        const search = findPrecisePosition(() => {});
        report(80);
        report(45);
        report(120);
        vi.advanceTimersByTime(10_000);
        expect((await search.position)?.accuracy).toBe(45);
        expect(watchers.size).toBe(0);
    });

    it("stops waiting with Use anyway", async () => {
        const search = findPrecisePosition(() => {});
        report(70);
        search.stopWaiting();
        expect((await search.position)?.accuracy).toBe(70);
    });

    it("waits again after you come back to the app", async () => {
        const stop = watchMyPosition();
        report(8);
        vi.advanceTimersByTime(5000);
        page.dispatchEvent(new Event("visibilitychange"));

        const search = findPrecisePosition(() => {});
        report(18);
        expect((await search.position)?.accuracy).toBe(18);
        stop();
    });
});
