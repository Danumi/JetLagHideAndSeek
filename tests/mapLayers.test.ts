import * as turf from "@turf/turf";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mapGeoJSON } from "@/lib/context";
import { findTransitLines } from "@/maps/api";
import {
    lineLabelPositions,
    MAP_LAYERS,
    placesInView,
    shownMapLayers,
    toggleMapLayer,
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
