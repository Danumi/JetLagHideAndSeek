import * as turf from "@turf/turf";
import { describe, expect, it, vi } from "vitest";

import { adminBorders } from "@/maps/questions/measuring";

// Three districts side by side: the seekers in the first, the hider in the last
const DISTRICTS = [16.3, 16.32, 16.34].map((west, i) =>
    turf.bboxPolygon([west, 48.2, west + 0.02, 48.22], {
        properties: { name: `District ${i + 1}` },
    }),
);

vi.mock("@/maps/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/maps/api")>()),
    findAdminAreas: vi.fn(async () => DISTRICTS),
}));

const metersTo = (
    borders: Awaited<ReturnType<typeof adminBorders>>,
    lng: number,
    lat: number,
) =>
    Math.min(
        ...turf.flatten(borders!).features.map((line) =>
            turf.pointToLineDistance(turf.point([lng, lat]), line, {
                units: "meters",
            }),
        ),
    );

describe("borders of a measuring question", () => {
    it("are those of every district, not just the seekers' own", async () => {
        const borders = await adminBorders(9);
        // Right next to the far edge of the third district
        expect(metersTo(borders, 16.3595, 48.21)).toBeLessThan(50);
        // In the middle of the first district: its own border
        expect(metersTo(borders, 16.31, 48.21)).toBeGreaterThan(700);
    });
});
