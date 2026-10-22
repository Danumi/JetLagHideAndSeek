import { describe, expect, it } from "vitest";

import { questionSchema } from "@/maps/schema";

describe("metric units", () => {
    it("converts radius questions saved in miles to kilometers", () => {
        const question = questionSchema.parse({
            id: "radius",
            data: { lat: 48.2, lng: 16.37, radius: 1, unit: "miles" },
        });

        expect(question.id).toBe("radius");
        if (question.id !== "radius") return;
        expect(question.data.unit).toBe("kilometers");
        expect(question.data.radius).toBeCloseTo(1.609344);
    });

    it("converts tentacle questions saved in miles to kilometers", () => {
        const question = questionSchema.parse({
            id: "tentacles",
            data: {
                lat: 48.2,
                lng: 16.37,
                radius: 15,
                unit: "miles",
                locationType: "zoo",
            },
        });

        if (question.id !== "tentacles") throw new Error("wrong type");
        expect(question.data.unit).toBe("kilometers");
        expect(question.data.radius).toBeCloseTo(24.14);
    });

    it("keeps metric questions unchanged", () => {
        const question = questionSchema.parse({
            id: "radius",
            data: { lat: 48.2, lng: 16.37, radius: 500, unit: "meters" },
        });

        if (question.id !== "radius") throw new Error("wrong type");
        expect(question.data.unit).toBe("meters");
        expect(question.data.radius).toBe(500);
    });

    it("starts new radius questions at 5 km", () => {
        const question = questionSchema.parse({
            id: "radius",
            data: { lat: 48.2, lng: 16.37 },
        });

        if (question.id !== "radius") throw new Error("wrong type");
        expect(question.data.unit).toBe("kilometers");
        expect(question.data.radius).toBe(5);
    });
});
