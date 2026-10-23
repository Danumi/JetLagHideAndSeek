import * as turf from "@turf/turf";
import { describe, expect, it } from "vitest";

import { applyQuestionsToMapGeoData } from "@/maps";
import { questionSchema } from "@/maps/schema";

const thermometer = (warmer: boolean) =>
    questionSchema.parse({
        id: "thermometer",
        data: {
            latA: 48.2,
            lngA: 16.3,
            latB: 48.21,
            lngB: 16.31,
            warmer,
            status: "answered",
            drag: false,
        },
    });

// Around Vienna
const AREA = turf.featureCollection([
    turf.bboxPolygon([16.18, 48.12, 16.58, 48.32]),
]);

describe("answers that contradict each other", () => {
    // Warmer and colder at once: at most a sliver along the border is left
    it("leave nothing instead of breaking the map", async () => {
        const left = await applyQuestionsToMapGeoData(
            [thermometer(true), thermometer(false)],
            AREA,
            false,
        );
        expect(left.features).toHaveLength(0);
    });

    it("still leave the area of one answer", async () => {
        const left = await applyQuestionsToMapGeoData(
            [thermometer(true)],
            AREA,
            false,
        );
        expect(left.features).toHaveLength(1);
    });
});
