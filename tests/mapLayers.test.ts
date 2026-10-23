import * as turf from "@turf/turf";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mapGeoJSON, overpassCustomHost } from "@/lib/context";
import { findTransitLines, placeCounts } from "@/maps/api";
import {
    lineLabelPositions,
    MAP_LAYERS,
    placesInView,
    shownMapLayers,
    toggleMapLayer,
    waterLabels,
    waterLabelsInView,
} from "@/maps/mapLayers";
import { DECK_PLACE_KINDS } from "@/maps/preload";

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

const track = (ref: number, ...points: [number, number][]) => ({
    type: "way",
    ref,
    role: "",
    geometry: points.map(([lon, lat]) => ({ lat, lon })),
});

describe("places and lines on the map", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        mapGeoJSON.set(null);
    });

    it("has a layer for every kind of place the cards ask about", () => {
        const places = MAP_LAYERS.filter((layer) => layer.location).map(
            (layer) => layer.location,
        );
        expect(places.sort()).toEqual([...DECK_PLACE_KINDS].sort());
        for (const layer of MAP_LAYERS) {
            expect(layer.label.en, layer.id).toBeTruthy();
            expect(layer.label.de, layer.id).toBeTruthy();
            expect(layer.group.de, layer.id).toBeTruthy();
        }
    });

    it("remembers what this phone shows", () => {
        shownMapLayers.set([]);
        toggleMapLayer("museum", true);
        toggleMapLayer("u-bahn", true);
        toggleMapLayer("museum", true);
        expect(shownMapLayers.get()).toEqual(["museum", "u-bahn"]);
        toggleMapLayer("museum", false);
        expect(shownMapLayers.get()).toEqual(["u-bahn"]);
    });

    it("draws places only while there are not too many in view", () => {
        const parks = [
            { lat: 48.2, lng: 16.37 },
            { lat: 48.21, lng: 16.38 },
            { lat: 48.3, lng: 16.5 },
        ];
        const view = { south: 48.19, west: 16.36, north: 48.22, east: 16.39 };
        expect(placesInView(parks, view, 2)).toHaveLength(2);
        expect(placesInView(parks, view, 1)).toBeNull();
    });

    it("finds the U-Bahn and S-Bahn lines with their colours", async () => {
        mapGeoJSON.set(
            turf.featureCollection([
                turf.bboxPolygon([16.18, 48.12, 16.58, 48.32]),
            ]),
        );
        overpassCustomHost.set("https://overpass.example/api/interpreter");
        vi.stubGlobal("caches", cacheStorage);
        const fetch = vi.fn(
            async () =>
                new Response(
                    JSON.stringify({
                        elements: [
                            {
                                type: "relation",
                                id: 1,
                                tags: { ref: "S45", route: "train" },
                                members: [
                                    track(10, [16.3, 48.2], [16.31, 48.25]),
                                ],
                            },
                            {
                                type: "relation",
                                id: 2,
                                tags: {
                                    ref: "U4",
                                    route: "subway",
                                    colour: "#319F49",
                                },
                                members: [
                                    track(20, [16.37, 48.2], [16.36, 48.21]),
                                    // A platform is not a track
                                    {
                                        ...track(
                                            21,
                                            [16.37, 48.2],
                                            [16.37, 48.2],
                                        ),
                                        role: "platform",
                                    },
                                    // Outside the game area: no geometry
                                    { type: "way", ref: 22, role: "" },
                                ],
                            },
                            {
                                // The other direction shares the tracks
                                type: "relation",
                                id: 3,
                                tags: { ref: "U4", route: "subway" },
                                members: [
                                    track(20, [16.37, 48.2], [16.36, 48.21]),
                                    track(23, [16.36, 48.21], [16.35, 48.22]),
                                ],
                            },
                        ],
                    }),
                ),
        );
        vi.stubGlobal("fetch", fetch);

        const lines = await findTransitLines();
        expect(lines.map((line) => line.ref)).toEqual(["U4", "S45"]);
        expect(lines[0].colour).toBe("#319F49");
        expect(lines[0].lines).toHaveLength(2);
        expect(lines[1].lines).toHaveLength(1);

        // Only within the game area
        const query = decodeURIComponent(
            String((fetch.mock.calls[0] as unknown[])[0]),
        );
        expect(query).toContain("(48.1000,16.1600,48.3400,16.6000)");
    });

    it("asks for no lines without a game area", async () => {
        const fetch = vi.fn();
        vi.stubGlobal("fetch", fetch);
        expect(await findTransitLines()).toEqual([]);
        expect(fetch).not.toHaveBeenCalled();
    });

    it("keeps the names of lines on shared tracks apart", () => {
        const shared = turf.lineString([
            [16.3, 48.2],
            [16.4, 48.2],
        ]);
        const positions = lineLabelPositions([
            { ref: "S1", lines: [shared] },
            { ref: "S2", lines: [shared] },
        ]);
        expect(positions).toHaveLength(2);
        expect(turf.distance(positions[0].at, positions[1].at)).toBeGreaterThan(
            0.8,
        );

        // In the game area, where the line runs there
        const [inCity] = lineLabelPositions(
            [{ ref: "S1", lines: [shared] }],
            ([lng]) => lng < 16.32,
        );
        expect(inCity.at[0]).toBeLessThan(16.32);
    });
});

describe("names of bodies of water", () => {
    const danube = turf.lineString(
        [
            [16.3, 48.25],
            [16.45, 48.15],
        ],
        { name: "Donau" },
    );
    const pond = turf.lineString(
        [
            [16.35, 48.2],
            [16.351, 48.2],
        ],
        { name: "Teich" },
    );
    const view = { south: 48.1, west: 16.2, north: 48.3, east: 16.5 };
    // A simple flat projection, 100 pixels per 0.01 degrees
    const toPixel = ([lng, lat]: number[]) => ({
        x: (lng - 16.2) * 10_000,
        y: (48.3 - lat) * 10_000,
    });

    it("writes each name once, the larger ones first", () => {
        const labels = waterLabels([pond, danube]);
        expect(labels.map((label) => label.name)).toEqual(["Donau", "Teich"]);
        expect(labels[0].candidates.length).toBeGreaterThan(10);
        // Zoomed in: the pond (about 75 m) is 75 pixels wide
        const shown = waterLabelsInView(labels, view, toPixel, 1000);
        expect(shown.map((label) => label.name)).toEqual(["Donau", "Teich"]);
    });

    it("names ponds of the same name in different places each", () => {
        const otherPond = turf.lineString(
            [
                [16.45, 48.12],
                [16.451, 48.12],
            ],
            { name: "Teich" },
        );
        const labels = waterLabels([pond, otherPond]);
        expect(labels).toHaveLength(2);
        expect(labels.every((label) => label.size < 0.2)).toBe(true);
    });

    it("leaves out water too small to see at this zoom", () => {
        const labels = waterLabels([pond, danube]);
        const shown = waterLabelsInView(labels, view, toPixel, 10);
        expect(shown.map((label) => label.name)).toEqual(["Donau"]);
    });

    it("writes nothing for water out of view", () => {
        const labels = waterLabels([pond]);
        const elsewhere = { south: 48.0, west: 16.0, north: 48.1, east: 16.1 };
        expect(waterLabelsInView(labels, elsewhere, toPixel, 1000)).toEqual([]);
    });
});

describe("places that count", () => {
    it("leaves out places without a name", () => {
        expect(placeCounts("park", { leisure: "park" })).toBe(false);
        expect(placeCounts("park", { name: "Stadtpark" })).toBe(true);
        expect(placeCounts("museum", { name: "Albertina" })).toBe(true);
        expect(placeCounts("zoo", undefined)).toBe(false);
    });

    it("counts only named peaks of at least 400 m as mountains", () => {
        expect(placeCounts("peak", { name: "Kahlenberg", ele: "484" })).toBe(
            true,
        );
        expect(placeCounts("peak", { name: "Bisamberg", ele: "425 m" })).toBe(
            true,
        );
        expect(placeCounts("peak", { name: "Laaer Berg", ele: "255" })).toBe(
            false,
        );
        expect(placeCounts("peak", { name: "Hügel" })).toBe(false);
        expect(placeCounts("peak", { ele: "494" })).toBe(false);
    });
});
