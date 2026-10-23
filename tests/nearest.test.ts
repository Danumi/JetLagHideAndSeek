import * as turf from "@turf/turf";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { language } from "@/lib/i18n";
import {
    findNamedWaterAreas,
    findNamedWaterLines,
    findPlacesOfKind,
} from "@/maps/api";
import {
    findNearest,
    hasNearest,
    markLabel,
    nearestLine,
    nearestName,
    nearestPlace,
    nearestText,
    zoneLabel,
} from "@/maps/nearest";
import { questionSchema } from "@/maps/schema";

vi.mock("@/maps/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/maps/api")>()),
    findPlacesOfKind: vi.fn(),
    findNamedWaterLines: vi.fn(),
    findNamedWaterAreas: vi.fn(async () => []),
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
    beforeEach(() => language.set("en"));

    it("reads like the cards", () => {
        expect(
            nearestText({
                kind: "distance",
                what: "museum",
                name: "Albertina",
                kilometers: 0.35,
            }),
        ).toBe("Nearest museum: Albertina, 350 m");
        expect(
            nearestText({
                kind: "distance",
                what: "water",
                name: "Alte Donau",
                kilometers: 1.23,
            }),
        ).toBe("Nearest body of water: Alte Donau, 1.2 km");
        expect(
            nearestText({
                kind: "inside",
                what: "Gemeindebezirk",
                name: "Wieden",
                adminLevel: 9,
            }),
        ).toBe("You are in Gemeindebezirk Wieden");
        expect(
            nearestText({
                kind: "border",
                what: "Gemeindebezirk",
                name: "Wieden",
                adminLevel: 9,
                kilometers: 0.23,
            }),
        ).toBe("You are 230 m from the border of Gemeindebezirk Wieden");
        expect(
            nearestText({ kind: "on", what: "landmass", landmass: "mainland" }),
        ).toBe("You are on the mainland");
        expect(
            nearestText({
                kind: "on",
                what: "landmass",
                landmass: "leopoldstadt",
            }),
        ).toBe(
            "You are between the Donaukanal and the Donau (2nd and 20th district)",
        );
        expect(
            nearestText({
                kind: "on",
                what: "landmass",
                landmass: "way/183963191",
                name: "Donauinsel",
            }),
        ).toBe("You are on Donauinsel");
        expect(
            nearestText({
                kind: "elevation",
                what: "sea-level",
                meters: 171.4,
            }),
        ).toBe("You are 171 m above sea level");
        expect(
            nearestText({
                kind: "distance",
                what: "station",
                name: "Karlsplatz",
                countCharacters: true,
                kilometers: 0.1,
            }),
        ).toBe("Nearest station: Karlsplatz (10 characters), 100 m");
    });

    it("reads like the cards in German", () => {
        language.set("de");
        expect(
            nearestText({
                kind: "distance",
                what: "museum",
                name: "Albertina",
                kilometers: 0.35,
            }),
        ).toBe("Nächstes Museum: Albertina, 350 m");
        expect(
            nearestText({
                kind: "distance",
                what: "water",
                name: "Alte Donau",
                kilometers: 1.23,
            }),
        ).toBe("Nächstes Gewässer: Alte Donau, 1,2 km");
        expect(
            nearestText({
                kind: "inside",
                what: "Gemeindebezirk",
                name: "Wieden",
                adminLevel: 9,
            }),
        ).toBe("Du bist im Gemeindebezirk Wieden");
        expect(
            nearestText({
                kind: "inside",
                what: "Katastralgemeinde",
                name: "Katastralgemeinde Innere Stadt",
                adminLevel: 10,
            }),
        ).toBe("Du bist in der Katastralgemeinde Innere Stadt");
        expect(
            nearestText({ kind: "on", what: "landmass", name: "Donauinsel" }),
        ).toBe("Du bist auf der Donauinsel");
        expect(
            nearestText({
                kind: "elevation",
                what: "sea-level",
                meters: 171.4,
            }),
        ).toBe("Du bist auf 171 m Seehöhe");
        expect(
            markLabel({
                kind: "distance",
                what: "park",
                mark: { at: [16.37, 48.2] },
            }),
        ).toBe("Park ohne Namen");
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

        expect(nearest?.what).toBe("amusement-park");
        expect(nearest && nearestName(nearest)).toBe(
            "an unnamed amusement park",
        );
        expect(nearest && markLabel(nearest)).toBe("Unnamed amusement park");
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

    it("is 0 m from the water on it, like on a bridge", async () => {
        vi.mocked(findNamedWaterAreas).mockResolvedValueOnce([
            turf.polygon(
                [
                    [
                        [16.369, 48.2],
                        [16.371, 48.2],
                        [16.371, 48.201],
                        [16.369, 48.201],
                        [16.369, 48.2],
                    ],
                ],
                { name: "Donaukanal" },
            ),
        ]);
        vi.mocked(findNamedWaterLines).mockResolvedValueOnce([]);

        // Elsewhere than the other questions: answers are remembered
        const onBridge = questionSchema.parse({
            id: "measuring",
            data: {
                ...SEEKERS,
                lat: 48.2005,
                type: "water",
                status: "pending",
            },
        });
        const nearest = await findNearest(onBridge);

        expect(nearest && nearestText(nearest)).toBe(
            "Nearest body of water: Donaukanal, 0 m",
        );
    });
});
