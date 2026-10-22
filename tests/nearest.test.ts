import * as turf from "@turf/turf";
import { describe, expect, it, vi } from "vitest";

import { findNamedWaterLines, findPlacesOfKind } from "@/maps/api";
import {
    findNearest,
    hasNearest,
    nearestLine,
    nearestPlace,
    nearestText,
    zoneLabel,
} from "@/maps/nearest";
import { questionSchema } from "@/maps/schema";

vi.mock("@/maps/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/maps/api")>()),
    findPlacesOfKind: vi.fn(),
    findNamedWaterLines: vi.fn(),
}));
vi.mock("@/maps/stations", () => ({
    findHidingZoneStations: vi.fn(async () => []),
    findStationPlaces: vi.fn(async () => []),
    hidingZoneStationsKey: () => "",
}));

// Karlsplatz
const SEEKERS = { lat: 48.2006, lng: 16.3699 };

const question = (
    id: "matching" | "measuring",
    type: string,
    cat?: { adminLevel: number },
) =>
    questionSchema.parse({
        id,
        data: { ...SEEKERS, type, ...(cat && { cat }), status: "pending" },
    });

describe("what's nearest to a question", () => {
    it("reads like the cards", () => {
        expect(
            nearestText({
                kind: "distance",
                what: "museum",
                label: "Albertina",
                kilometers: 0.35,
            }),
        ).toBe("Nearest museum: Albertina, 350 m");
        expect(
            nearestText({
                kind: "distance",
                what: "body of water",
                label: "Alte Donau",
                kilometers: 1.23,
            }),
        ).toBe("Nearest body of water: Alte Donau, 1.2 km");
        expect(
            nearestText({
                kind: "inside",
                what: "Gemeindebezirk",
                label: "Gemeindebezirk Wieden",
            }),
        ).toBe("You are in Gemeindebezirk Wieden");
        expect(
            nearestText({
                kind: "border",
                what: "Gemeindebezirk border",
                label: "Gemeindebezirk Wieden",
                kilometers: 0.23,
            }),
        ).toBe("You are 230 m from the border of Gemeindebezirk Wieden");
        expect(
            nearestText({
                kind: "on",
                what: "landmass",
                label: "the mainland",
            }),
        ).toBe("You are on the mainland");
        expect(
            nearestText({
                kind: "elevation",
                what: "sea level",
                label: "",
                meters: 171.4,
            }),
        ).toBe("You are 171 m above sea level");
    });

    it("names the zones like Vienna does", () => {
        expect(zoneLabel(9, "Wieden")).toBe("Gemeindebezirk Wieden");
        expect(zoneLabel(4, "Wien")).toBe("Bundesland Wien");
        // OSM already calls them so
        expect(zoneLabel(10, "Katastralgemeinde Innere Stadt")).toBe(
            "Katastralgemeinde Innere Stadt",
        );
    });

    it("finds the nearest place and line", () => {
        const best = nearestPlace(
            [
                { name: "Far", lat: 48.21, lng: 16.37 },
                { name: "Near", lat: 48.201, lng: 16.37 },
            ],
            SEEKERS,
        );
        expect(best?.place.name).toBe("Near");

        const line = nearestLine(
            [
                turf.lineString([
                    [16.36, 48.202],
                    [16.38, 48.202],
                ]),
            ],
            SEEKERS,
        );
        expect(line?.kilometers).toBeCloseTo(0.156, 2);
        expect(line?.at[1]).toBeCloseTo(48.202, 5);
    });

    it("knows which questions it can explain", () => {
        expect(hasNearest(question("matching", "museum-full"))).toBe(true);
        expect(
            hasNearest(question("matching", "zone", { adminLevel: 9 })),
        ).toBe(true);
        expect(hasNearest(question("measuring", "water"))).toBe(true);
        expect(hasNearest(question("measuring", "coastline"))).toBe(false);
        expect(hasNearest(question("matching", "airport"))).toBe(false);
    });

    it("names the nearest place of a card", async () => {
        vi.mocked(findPlacesOfKind).mockResolvedValueOnce({
            elements: [
                {
                    type: "node",
                    lat: 48.2045,
                    lon: 16.3681,
                    tags: { name: "Albertina" },
                },
                {
                    type: "way",
                    center: { lat: 48.1987, lon: 16.3719 },
                    tags: {},
                },
            ],
        });

        const nearest = await findNearest(
            question("matching", "theme_park-full"),
        );

        expect(nearest?.what).toBe("amusement park");
        expect(nearest?.label).toBe("an unnamed amusement park");
        expect(nearest?.mark?.at).toEqual([16.3719, 48.1987]);
    });

    it("marks the whole river nearest to the seekers", async () => {
        vi.mocked(findNamedWaterLines).mockResolvedValueOnce([
            turf.lineString(
                [
                    [16.36, 48.203],
                    [16.37, 48.203],
                ],
                { name: "Wien" },
            ),
            turf.lineString(
                [
                    [16.37, 48.203],
                    [16.38, 48.204],
                ],
                { name: "Wien" },
            ),
            turf.lineString(
                [
                    [16.41, 48.23],
                    [16.42, 48.24],
                ],
                { name: "Alte Donau" },
            ),
        ]);

        const nearest = await findNearest(question("measuring", "water"));

        expect(nearest && nearestText(nearest)).toBe(
            "Nearest body of water: Wien, 267 m",
        );
        expect(nearest?.mark?.lines).toHaveLength(2);
    });
});
