import * as turf from "@turf/turf";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mapGeoJSON } from "@/lib/context";
import { clearCache, findPlacesOfKind } from "@/maps/api";
import { preloadGameData } from "@/maps/preload";

vi.mock("@/maps/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/maps/api")>()),
    clearCache: vi.fn(async () => {}),
    findPlacesOfKind: vi.fn(async () => ({})),
    findHighSpeedLines: vi.fn(async () => ({})),
    findLandmassIslands: vi.fn(async () => ({})),
    findNamedWaterLines: vi.fn(async () => ({})),
    preloadElevation: vi.fn(async () => true),
    findStationLines: vi.fn(async () => []),
}));
vi.mock("@/maps/stations", () => ({
    findHidingZoneStations: vi.fn(async () => []),
}));

const DAY_MS = 24 * 60 * 60 * 1000;

describe("preloadGameData", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("continues an unfinished preload and refreshes data after a week", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
        mapGeoJSON.set(
            turf.featureCollection([
                turf.bboxPolygon([16.2, 48.1, 16.6, 48.3]),
            ]),
        );

        // The first new game stops halfway, e.g. a server failed
        vi.mocked(findPlacesOfKind).mockRejectedValueOnce(new Error("down"));
        await preloadGameData({ refreshOldData: true });
        expect(clearCache).not.toHaveBeenCalled();

        // The next new game keeps what was already loaded
        vi.setSystemTime(new Date("2026-10-22T13:00:00Z"));
        await preloadGameData({ refreshOldData: true });
        expect(clearCache).not.toHaveBeenCalled();

        // A week after the data started loading, a new game loads it afresh
        vi.setSystemTime(
            new Date(Date.parse("2026-10-22T12:00:00Z") + 8 * DAY_MS),
        );
        await preloadGameData({ refreshOldData: true });
        expect(clearCache).toHaveBeenCalledTimes(2);

        // ... and then keeps it for another week
        vi.mocked(clearCache).mockClear();
        vi.setSystemTime(
            new Date(Date.parse("2026-10-22T12:00:00Z") + 9 * DAY_MS),
        );
        await preloadGameData({ refreshOldData: true });
        expect(clearCache).not.toHaveBeenCalled();
    });
});
