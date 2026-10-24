import * as turf from "@turf/turf";
import { describe, expect, it } from "vitest";

import type { StationPlace, TransitLine } from "@/maps/api";
import {
    seekersLine,
    stationsOnSeekersLine,
    subwayLinesOf,
} from "@/maps/subwayLines";

const station = (id: string, name: string, lng: number, lat: number) =>
    turf.point([lng, lat], {
        id,
        name,
        railway: "station",
        subway: "yes",
    }) as unknown as StationPlace;

// Karlsplatz once for all three lines, as the hiding zones merge it
const STATIONS = [
    station("node/3503264091", "Karlsplatz", 16.3699, 48.2006),
    station("node/3500582336", "Taubstummengasse", 16.3713, 48.1951),
    station("node/4123615290", "Museumsquartier", 16.3613, 48.2025),
    station("node/3993342689", "Kettenbrückengasse", 16.3584, 48.1966),
    station("node/4003977156", "Schwedenplatz", 16.3779, 48.2116),
];

const line = (
    ref: string,
    route: string,
    ...stops: [number, number][]
): TransitLine => ({ ref, route, lines: [], stops });

const LINES = [
    // The U1 stops a few meters from its stations
    line(
        "U1",
        "subway",
        [16.3701, 48.2004],
        [16.3714, 48.1953],
        [16.378, 48.2118],
    ),
    line("U2", "subway", [16.3695, 48.2008], [16.3611, 48.2024]),
    line(
        "U4",
        "subway",
        [16.3697, 48.2005],
        [16.3586, 48.1967],
        [16.3781, 48.2114],
        // Hütteldorf, beyond the stations here
        [16.2614, 48.1966],
    ),
    // The S-Bahn and trams don't count
    line("S1", "train", [16.3701, 48.2004]),
    line("D", "tram", [16.3714, 48.1953]),
];

const ids = (lineKey: string) =>
    subwayLinesOf(LINES, STATIONS).find((l) => l.key === lineKey)?.stationIds;

describe("U-Bahn lines", () => {
    it("stop at the stations nearest to their stops", () => {
        const lines = subwayLinesOf(LINES, STATIONS);
        expect(lines.map((l) => l.key)).toEqual([
            "subway:U1",
            "subway:U2",
            "subway:U4",
        ]);
        expect(ids("subway:U1")).toEqual([
            "node/3503264091",
            "node/3500582336",
            "node/4003977156",
        ]);
        expect(ids("subway:U4")).toEqual([
            "node/3503264091",
            "node/3993342689",
            "node/4003977156",
        ]);
    });

    it("are the one the seekers chose, or the only one at their station", () => {
        const lines = subwayLinesOf(LINES, STATIONS);
        // At Kettenbrückengasse only the U4 stops
        const atKettenbrücke = { lat: 48.1968, lng: 16.358 };
        expect(seekersLine(lines, STATIONS, atKettenbrücke).chosen?.key).toBe(
            "subway:U4",
        );
        expect(
            seekersLine(lines, STATIONS, {
                ...atKettenbrücke,
                lineKey: "subway:U1",
            }).chosen?.key,
        ).toBe("subway:U1");

        // At Karlsplatz three lines stop: none until the seekers choose
        const atKarlsplatz = { lat: 48.2007, lng: 16.37 };
        const { atStation, chosen } = seekersLine(
            lines,
            STATIONS,
            atKarlsplatz,
        );
        expect(atStation.map((l) => l.label)).toEqual(["U1", "U2", "U4"]);
        expect(chosen).toBeUndefined();
        // An old answer with a bus line: like none chosen
        expect(
            seekersLine(lines, STATIONS, {
                ...atKarlsplatz,
                lineKey: "bus:13A",
            }).chosen,
        ).toBeUndefined();
    });

    it("rule out only what's certain while no line is chosen", () => {
        const lines = subwayLinesOf(LINES, STATIONS);
        const atKarlsplatz = { lat: 48.2007, lng: 16.37 };
        // Same: a station of any of the three lines
        expect(
            stationsOnSeekersLine(lines, STATIONS, atKarlsplatz, true).size,
        ).toBe(5);
        // Different: only Karlsplatz itself is on all three
        expect([
            ...stationsOnSeekersLine(lines, STATIONS, atKarlsplatz, false),
        ]).toEqual(["node/3503264091"]);
        // The U2 chosen: its stations only
        expect([
            ...stationsOnSeekersLine(
                lines,
                STATIONS,
                { ...atKarlsplatz, lineKey: "subway:U2" },
                false,
            ),
        ]).toEqual(["node/3503264091", "node/4123615290"]);
    });
});
