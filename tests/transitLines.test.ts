import * as turf from "@turf/turf";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mapGeoJSON, overpassCustomHost } from "@/lib/context";
import { findTramLines } from "@/maps/api";

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

const queryOf = (call: unknown[]) =>
    new URL(String(call[0])).searchParams.get("data") ?? "";

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
                                        type: "node",
                                        ref: 1,
                                        role: "stop",
                                        lat: 48.2,
                                        lon: 16.37,
                                    },
                                    {
                                        type: "node",
                                        ref: 2,
                                        role: "stop",
                                        lat: 48.21,
                                        lon: 16.36,
                                    },
                                    // Outside the game area: no geometry
                                    { type: "node", ref: 3, role: "stop" },
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
        // Nußdorf is on the map, Absberggasse beyond it
        expect(tram.ends).toEqual([
            { name: "Nußdorf", at: [16.37, 48.2], beyond: false },
            { name: "Absberggasse", at: [16.36, 48.21], beyond: true },
        ]);
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
