import * as turf from "@turf/turf";
import { describe, expect, it } from "vitest";

import {
    landmassArea,
    landmassOf,
    viennaLandmassesFrom,
} from "@/maps/landmass";

/*
 * A small Vienna from west to east, in steps of 0.001° (about 74 m): the
 * Innere Stadt, the Donaukanal, Leopoldstadt and Brigittenau, the Donau,
 * the Donauinsel, the Neue Donau, Donaustadt and Floridsdorf with a lake.
 */
const area = (
    west: number,
    east: number,
    south: number,
    north: number,
    properties: Record<string, string>,
    id?: string,
) => {
    const x = (step: number) => 16.4 + step * 0.001;
    const y = (step: number) => 48.2 + step * 0.001;
    return turf.polygon(
        [
            [
                [x(west), y(south)],
                [x(east), y(south)],
                [x(east), y(north)],
                [x(west), y(north)],
                [x(west), y(south)],
            ],
        ],
        properties,
        id ? { id } : undefined,
    );
};

const island = area(20, 23, 0, 10, { name: "Donauinsel" }, "way/1");
// District borders run a few meters off the bank, as in OSM
const districts = [
    area(0, 9.95, 0, 10, { name: "Innere Stadt" }),
    area(9.95, 20, 0, 5, { name: "Leopoldstadt" }),
    area(9.95, 20, 5, 10, { name: "Brigittenau" }),
    area(20, 30, 0, 5, { name: "Donaustadt" }),
    area(20, 30, 5, 10, { name: "Floridsdorf" }),
];
const waters = [
    area(10, 11, 0, 10, { name: "Donaukanal", natural: "water" }),
    area(16, 20, 0, 10, { name: "Donau", natural: "water" }),
    area(23, 25, 0, 10, { name: "Neue Donau", natural: "water" }),
    area(27, 28, 2, 4, { name: "Alte Donau", natural: "water" }),
];
const all = viennaLandmassesFrom([island], districts, waters)!;

const at = (step: number, north = 2.5) => ({
    lat: 48.2 + north * 0.001,
    lng: 16.4 + step * 0.001,
});
const landmassAtStep = (step: number, north?: number) => {
    const landmass = landmassOf(all, at(step, north));
    return landmass.name ?? landmass.id;
};

describe("Vienna's landmasses", () => {
    it("are four: Donau, Neue Donau and Donaukanal split the city", () => {
        expect(all.landmasses.map((landmass) => landmass.id)).toEqual([
            "way/1",
            "leopoldstadt",
            "transdanubia",
            "rest",
        ]);
        expect(
            all.waterways.map((water) => water.properties?.name).sort(),
        ).toEqual(["Donau", "Donaukanal", "Neue Donau"]);

        expect(landmassAtStep(5)).toBe("rest");
        expect(landmassAtStep(13)).toBe("leopoldstadt");
        expect(landmassAtStep(13, 7)).toBe("leopoldstadt"); // Brigittenau
        expect(landmassAtStep(21)).toBe("Donauinsel");
        expect(landmassAtStep(27)).toBe("transdanubia");
        expect(landmassAtStep(27, 7)).toBe("transdanubia"); // Floridsdorf
    });

    it("count a bridge or a boat to the nearer shore", () => {
        expect(landmassAtStep(10.2)).toBe("rest");
        expect(landmassAtStep(10.8)).toBe("leopoldstadt");
        expect(landmassAtStep(16.5)).toBe("leopoldstadt");
        expect(landmassAtStep(19.5)).toBe("Donauinsel");
        expect(landmassAtStep(23.3)).toBe("Donauinsel");
        expect(landmassAtStep(24.7)).toBe("transdanubia");
    });

    it("keep the land at the bank where it is, whatever the district says", () => {
        // In Leopoldstadt by its border, but on the Innere Stadt's bank
        expect(landmassAtStep(9.97)).toBe("rest");
    });

    it("keep islands in lakes with the land around them", () => {
        expect(landmassAtStep(27.5, 3)).toBe("transdanubia");
    });

    it("leave the rest of the map to the rest of Vienna", () => {
        const rest = all.landmasses.find((landmass) => landmass.id === "rest")!;
        const everything = area(0, 30, 0, 10, {});
        const restArea = landmassArea(all, rest, everything)!;
        expect(
            turf.booleanPointInPolygon(turf.point([16.405, 48.2025]), restArea),
        ).toBe(true);
        expect(
            turf.booleanPointInPolygon(turf.point([16.413, 48.2025]), restArea),
        ).toBe(false);
        expect(
            turf.booleanPointInPolygon(turf.point([16.421, 48.2025]), restArea),
        ).toBe(false);
    });

    it("need the districts", () => {
        expect(
            viennaLandmassesFrom([island], districts.slice(0, 2), waters),
        ).toBeNull();
    });
});
