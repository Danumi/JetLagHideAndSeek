import * as turf from "@turf/turf";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mapGeoJSON, overpassCustomHost } from "@/lib/context";
import { findAdminAreas, findAdminBoundary, getOverpassData } from "@/maps/api";
import { packageKey } from "@/maps/api/mapDataPackage";

// A minimal Cache API, as in the browser
const cacheStores = new Map<string, Map<string, Response>>();
vi.stubGlobal("caches", {
    open: async (name: string) => {
        const store = cacheStores.get(name) ?? new Map<string, Response>();
        cacheStores.set(name, store);
        return {
            match: async (url: string) => store.get(url)?.clone(),
            put: async (url: string, response: Response) => {
                store.set(url, response);
            },
            delete: async (url: string) => store.delete(url),
            keys: async () => [...store.keys()],
        };
    },
});

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status });

const OWN = "https://own.example/api/interpreter";
const PACKAGED = "[out:json];node(1);out;";

/** A package with the answer to PACKAGED, and servers that answer anything. */
const packageAndServers = async () => {
    const key = await packageKey(PACKAGED);
    const fetch = vi.fn(async (url: string) => {
        if (url.endsWith("map-data/index.json")) {
            return json({ createdAt: "2026-10-26T03:00:00Z", keys: [key] });
        }
        if (url.endsWith(`map-data/${key}.json`)) {
            return json({ elements: [{ id: 1, from: "package" }] });
        }
        if (url.includes("/map-data/"))
            return new Response("", { status: 404 });
        return json({ elements: [{ id: 2, from: "server" }] });
    });
    vi.stubGlobal("fetch", fetch);
    return fetch;
};

const serverCalls = (fetch: ReturnType<typeof vi.fn>) =>
    fetch.mock.calls.filter(([url]) => !String(url).includes("/map-data/"));

describe("map data package", () => {
    afterEach(() => {
        overpassCustomHost.set("");
    });

    it("names an answer by the hash of its query, like scripts/map-data.mjs", async () => {
        expect(await packageKey("abc")).toBe(
            "ba7816bf8f01cfea414140de5dae2223",
        );
    });

    it("answers from the package without asking a server, and keeps the answer", async () => {
        overpassCustomHost.set(OWN);
        const fetch = await packageAndServers();
        expect(await getOverpassData(PACKAGED)).toEqual({
            elements: [{ id: 1, from: "package" }],
        });
        expect(serverCalls(fetch)).toHaveLength(0);

        // Kept in the cache like an answer from the first server
        const cache = cacheStores.get("jlhs-map-generator-cache");
        expect([...(cache?.keys() ?? [])][0]).toMatch(
            /^https:\/\/own\.example\//,
        );
        const calls = fetch.mock.calls.length;
        expect(await getOverpassData(PACKAGED)).toEqual({
            elements: [{ id: 1, from: "package" }],
        });
        expect(fetch.mock.calls.length).toBe(calls);
    });

    it("asks the servers for what the package doesn't have", async () => {
        const fetch = await packageAndServers();
        expect(await getOverpassData("[out:json];node(2);out;")).toEqual({
            elements: [{ id: 2, from: "server" }],
        });
        expect(serverCalls(fetch)).toHaveLength(1);
    });
});

describe("administrative areas", () => {
    // A game area of 0.1° around (16.35, 48.2), with two districts in it
    const district = (
        id: number,
        name: string,
        west: number,
        east: number,
    ) => ({
        type: "relation",
        id,
        bounds: { minlat: 48.16, minlon: west, maxlat: 48.24, maxlon: east },
        members: [
            {
                type: "way",
                ref: id * 10,
                role: "outer",
                geometry: [
                    { lat: 48.16, lon: west },
                    { lat: 48.16, lon: east },
                    { lat: 48.24, lon: east },
                    { lat: 48.24, lon: west },
                    { lat: 48.16, lon: west },
                ],
            },
        ],
        tags: {
            type: "boundary",
            boundary: "administrative",
            admin_level: "9",
            name,
        },
    });
    const west = district(1, "Westbezirk", 16.31, 16.35);
    const east = district(2, "Ostbezirk", 16.35, 16.39);
    // Around the game area, much larger: left out of the outlines
    const surrounding = {
        type: "relation",
        id: 3,
        bounds: { minlat: 47, minlon: 15, maxlat: 49, maxlon: 17 },
        tags: { boundary: "administrative", admin_level: "9" },
    };

    const servers = () => {
        const fetch = vi.fn(async (url: string) => {
            if (url.includes("/map-data/"))
                return new Response("", { status: 404 });
            const query = decodeURIComponent(url.split("?data=")[1]);
            if (query.includes("out tags bb")) {
                return json({
                    elements: [west, east, surrounding].map(
                        ({ type, id, bounds, tags }) => ({
                            type,
                            id,
                            bounds,
                            tags,
                        }),
                    ),
                });
            }
            if (query.includes("rel(id:1,2)"))
                return json({ elements: [west, east] });
            if (query.includes("is_in")) {
                return json({ elements: [{ ...surrounding, members: [] }] });
            }
            return new Response("", { status: 400 });
        });
        vi.stubGlobal("fetch", fetch);
        return fetch;
    };

    it("finds the area of a point in the game area from the outlines of all areas", async () => {
        mapGeoJSON.set(
            turf.featureCollection([
                turf.bboxPolygon([16.3, 48.15, 16.4, 48.25]),
            ]) as never,
        );
        const fetch = servers();

        const area = await findAdminBoundary(48.2, 16.37, 9);
        expect(area?.properties?.name).toBe("Ostbezirk");
        expect(
            (await findAdminBoundary(48.2, 16.33, 9))?.properties?.name,
        ).toBe("Westbezirk");

        // One query for the areas, one for their outlines, none per point
        const queries = fetch.mock.calls
            .map(([url]) => String(url))
            .filter((url) => url.includes("?data="))
            .map((url) => decodeURIComponent(url.split("?data=")[1]));
        expect(queries).toHaveLength(2);
        expect(queries[1]).toContain("rel(id:1,2);out geom;");
        expect(queries.some((query) => query.includes("is_in"))).toBe(false);
    });

    it("leaves out buildings tagged with an admin level", async () => {
        // Another game area: the areas of the one above are remembered
        mapGeoJSON.set(
            turf.featureCollection([
                turf.bboxPolygon([16.3, 48.15, 16.41, 48.25]),
            ]) as never,
        );
        // Like the "Amtshaus für den 16. Bezirk" in Ottakring
        const amtshaus = {
            ...district(4, "Amtshaus", 16.36, 16.362),
            tags: {
                type: "multipolygon",
                building: "yes",
                admin_level: "9",
                name: "Amtshaus",
            },
        };
        vi.stubGlobal(
            "fetch",
            vi.fn(async (url: string) => {
                if (url.includes("/map-data/"))
                    return new Response("", { status: 404 });
                const query = decodeURIComponent(url.split("?data=")[1]);
                if (query.includes("out tags bb")) {
                    return json({
                        elements: [west, east, amtshaus].map(
                            ({ type, id, bounds, tags }) => ({
                                type,
                                id,
                                bounds,
                                tags,
                            }),
                        ),
                    });
                }
                if (query.includes("rel(id:1,2,4)"))
                    return json({ elements: [west, east, amtshaus] });
                return new Response("", { status: 400 });
            }),
        );

        expect(
            (await findAdminAreas(9)).map((area) => area.properties?.name),
        ).toEqual(["Westbezirk", "Ostbezirk"]);
        expect(
            (await findAdminBoundary(48.2, 16.361, 9))?.properties?.name,
        ).toBe("Ostbezirk");
    });

    it("asks the server for a point outside of all areas", async () => {
        const fetch = servers();
        await findAdminBoundary(48.5, 16.0, 9);
        expect(
            fetch.mock.calls.some(([url]) =>
                decodeURIComponent(String(url)).includes("is_in(48.5, 16)"),
            ),
        ).toBe(true);
    });
});
