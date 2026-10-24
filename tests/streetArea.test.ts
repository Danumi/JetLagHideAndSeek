import * as turf from "@turf/turf";
import { describe, expect, it } from "vitest";

import { streetArea, type StreetWay } from "@/maps/streetArea";

// Meters around a point in Vienna (Wieden), as [lng, lat]
const LAT = 48.19;
const LNG = 16.37;
const at = (east: number, north: number) => [
    LNG + east / (111_320 * Math.cos((LAT * Math.PI) / 180)),
    LAT + north / 110_574,
];
const street = (
    id: number,
    name: string | null,
    ...points: [number, number][]
): StreetWay => ({ id, name, points: points.map(([e, n]) => at(e, n)) });

const inside = (
    area: ReturnType<typeof streetArea>["possible"],
    east: number,
    north: number,
) => !!area && turf.booleanPointInPolygon(at(east, north), area);

describe("where a street is the nearest one", () => {
    // Favoritenstraße running north, Schönburgstraße 80 m west of it, and
    // Mühlgasse crossing both
    const streets = [
        street(1, "Favoritenstraße", [0, -400], [0, 0]),
        street(2, "Favoritenstraße", [0, 0], [0, 400]),
        street(3, "Schönburgstraße", [-80, -400], [-80, 400]),
        street(4, "Mühlgasse", [-300, 0], [300, 0]),
    ];
    const { possible, certain } = streetArea(
        { id: 1, name: "Favoritenstraße" },
        streets,
    );

    it("is a strip along the street, all parts with its name", () => {
        expect(inside(possible, 10, 200)).toBe(true);
        expect(inside(possible, -30, -200)).toBe(true);
        expect(inside(certain, 10, 200)).toBe(true);
        expect(inside(certain, -20, -200)).toBe(true);
        // Nearer to Schönburgstraße, or nowhere near
        expect(inside(possible, -55, 200)).toBe(false);
        expect(inside(possible, 150, 200)).toBe(false);
    });

    it("stops where a cross street is nearer", () => {
        // 30 m east and 10 m north of the crossing: Mühlgasse is nearer
        expect(inside(possible, 30, 10)).toBe(false);
        expect(inside(certain, 30, 10)).toBe(false);
        // Beyond the reach of 100 m nothing is nearest
        expect(inside(possible, 120, 300)).toBe(false);
    });

    it("rules out only what is certain, keeps what is possible", () => {
        // On the edge between the two streets, 40 m from each
        expect(inside(possible, -40, 200)).toBe(true);
        expect(inside(certain, -40, 200)).toBe(false);
    });

    it("lets a named street win over a path a few meters nearer", () => {
        const withPath = [...streets, street(5, null, [6, -400], [6, 400])];
        const area = streetArea({ id: 1, name: "Favoritenstraße" }, withPath);
        // The path runs 6 m east: next to it, the street still counts
        expect(inside(area.certain, 12, 200)).toBe(true);
        // A path of its own, nearest with nothing named close by
        const path = streetArea({ id: 5, name: null }, [
            street(5, null, [0, 0], [0, 100]),
            street(6, null, [60, 0], [60, 100]),
        ]);
        expect(inside(path.certain, 10, 50)).toBe(true);
        expect(inside(path.possible, 50, 50)).toBe(false);
    });

    it("is nothing for a street that isn't there", () => {
        expect(streetArea({ id: 9, name: "Nirgendgasse" }, streets)).toEqual({
            possible: null,
            certain: null,
        });
    });

    it("works out a long street in a dense grid quickly", () => {
        // 4 km of Favoritenstraße, streets every 80 m in both directions
        const grid: StreetWay[] = [
            street(1, "Favoritenstraße", [0, -2000], [0, 2000]),
        ];
        let id = 10;
        for (let x = -240; x <= 240; x += 80) {
            if (x !== 0)
                grid.push(street(id++, `Gasse ${id}`, [x, -2000], [x, 2000]));
        }
        for (let y = -2000; y <= 2000; y += 80) {
            grid.push(street(id++, `Quergasse ${id}`, [-240, y], [240, y]));
        }
        const started = performance.now();
        const area = streetArea({ id: 1, name: "Favoritenstraße" }, grid);
        expect(performance.now() - started).toBeLessThan(3000);
        expect(inside(area.certain, 15, 40)).toBe(true);
        expect(inside(area.possible, 0, 1200)).toBe(true);
        expect(inside(area.possible, 60, 1240)).toBe(false);
    });
});
