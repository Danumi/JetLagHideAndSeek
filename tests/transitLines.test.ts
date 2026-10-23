import * as turf from "@turf/turf";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mapGeoJSON, overpassCustomHost } from "@/lib/context";
import {
    findLinesNear,
    findSeekerLines,
    findTramLines,
    trainLineNodeFinder,
} from "@/maps/api";

// These tests are about the servers: no map data package
vi.mock("@/maps/api/mapDataPackage", () => ({
    packagedResponse: async () => null,
}));

// A minimal Cache API, as in the browser
const cacheStorage = {
    open: async () => {
        const store = new Map<string, Response>();
        return {
            match: async (url: string) => store.get(url)?.clone(),
            put: async (url: string, response: Response) => {
                store.set(url, response);
            },
            delete: async (url: string) => store.delete(url),
            keys: async () => [...store.keys()],
        };
    },
};

const line = (route: string, ref: string, ...stations: number[]) => [
    { type: "relation", id: stations[0], tags: { type: "route", route, ref } },
    ...stations.map((id) => ({ type: "node", id })),
];

/** Answers like Overpass: the lines at the station or where the seekers are. */
const answer = (query: string) => {
    if (query.includes("node(1)->.s")) {
        // At Karlsplatz: the U4 and tram D
        return [...line("subway", "U4", 1, 2), ...line("tram", "D", 1, 3)];
    }
    if (query.includes("around:100,")) {
        // On the bus 13A, a few streets away; the U4 runs there too
        return [...line("subway", "U4", 1, 5), ...line("bus", "13A", 4, 6)];
    }
    return [];
};

const queryOf = (call: unknown[]) =>
    new URL(String(call[0])).searchParams.get("data") ?? "";

describe("lines of the seekers", () => {
    beforeEach(() => {
        mapGeoJSON.set(
            turf.featureCollection([
                turf.bboxPolygon([16.18, 48.12, 16.58, 48.32]),
            ]),
        );
        overpassCustomHost.set("https://a.example/x/interpreter");
        vi.stubGlobal("caches", cacheStorage);
        vi.stubGlobal(
            "fetch",
            vi.fn(
                async (url: string) =>
                    new Response(
                        JSON.stringify({
                            elements: answer(queryOf([url])),
                        }),
                    ),
            ),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        mapGeoJSON.set(null);
        overpassCustomHost.set("");
    });

    it("finds the lines running where the seekers are, buses too", async () => {
        const lines = await findLinesNear(48.2, 16.37);
        expect(lines.map((line) => line.key)).toEqual(["subway:U4", "bus:13A"]);
        const query = queryOf((fetch as any).mock.calls[0]);
        expect(query).toContain("around:100,48.20000,16.37000");
        expect(query).toContain("bus");
    });

    it("offers the lines at the station and where the seekers are", async () => {
        const lines = await findSeekerLines("node/1", {
            lat: 48.2,
            lng: 16.37,
        });
        expect(lines.map((line) => line.key)).toEqual([
            "subway:U4",
            "tram:D",
            "bus:13A",
        ]);
        // The U4 once, with the stations of both answers
        expect(lines[0].stationIds.sort()).toEqual([1, 2, 5]);
    });

    it("knows the stations of the bus the seekers chose", async () => {
        const at = { lat: 48.2, lng: 16.37 };
        expect(
            await trainLineNodeFinder("node/1", "bus:13A", true, at),
        ).toEqual([4, 6]);
        // Not chosen: every station of every line there
        expect(
            (await trainLineNodeFinder("node/1", undefined, true, at)).sort(),
        ).toEqual([1, 2, 3, 4, 5, 6]);
        // Without where they are: only the lines at the station
        expect(
            (await trainLineNodeFinder("node/1", undefined, true)).sort(),
        ).toEqual([1, 2, 3]);
    });
});

describe("tram lines on the map", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        mapGeoJSON.set(null);
        overpassCustomHost.set("");
    });

    it("finds the tram lines in one colour", async () => {
        mapGeoJSON.set(
            turf.featureCollection([
                turf.bboxPolygon([16.18, 48.12, 16.58, 48.32]),
            ]),
        );
        overpassCustomHost.set("https://a.example/x/interpreter");
        vi.stubGlobal("caches", cacheStorage);
        const fetch = vi.fn(
            async () =>
                new Response(
                    JSON.stringify({
                        elements: [
                            {
                                type: "relation",
                                id: 1,
                                tags: {
                                    ref: "D",
                                    route: "tram",
                                    colour: "#E3000F",
                                    from: "Nußdorf",
                                    to: "Absberggasse",
                                },
                                members: [
                                    {
                                        type: "way",
                                        ref: 10,
                                        role: "",
                                        geometry: [
                                            { lat: 48.2, lon: 16.37 },
                                            { lat: 48.21, lon: 16.36 },
                                        ],
                                    },
                                ],
                            },
                        ],
                    }),
                ),
        );
        vi.stubGlobal("fetch", fetch);

        const [tram] = await findTramLines();
        expect(tram.ref).toBe("D");
        expect(tram.colour).toBeUndefined();
        expect([tram.from, tram.to]).toEqual(["Nußdorf", "Absberggasse"]);
        const query = queryOf(fetch.mock.calls[0] as unknown[]);
        expect(query).toContain('["route"="tram"]');
        expect(query).toContain("(48.1000,16.1600,48.3400,16.6000)");
    });

    it("asks for no tram lines without a game area", async () => {
        const fetch = vi.fn();
        vi.stubGlobal("fetch", fetch);
        expect(await findTramLines()).toEqual([]);
        expect(fetch).not.toHaveBeenCalled();
    });
});
