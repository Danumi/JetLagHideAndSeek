import { describe, expect, it } from "vitest";

import { parsePositiveNumber } from "@/components/PositiveNumberInput";
import { questionTitle } from "@/maps/answers";
import { questionSchema, questionsSchema } from "@/maps/schema";

describe("emptied number fields", () => {
    it("only passes on numbers above 0", () => {
        expect(parsePositiveNumber("")).toBeNull();
        expect(parsePositiveNumber("0")).toBeNull();
        expect(parsePositiveNumber("-3")).toBeNull();
        expect(parsePositiveNumber("abc")).toBeNull();
        expect(parsePositiveNumber("7")).toBe(7);
        expect(parsePositiveNumber("2,5")).toBe(2.5);
    });

    it("loads a radar saved with an empty radius", () => {
        // JSON turns the NaN of an emptied field into null
        const saved = JSON.parse(
            JSON.stringify([
                {
                    id: "radius",
                    data: {
                        lat: 48.2,
                        lng: 16.37,
                        radius: NaN,
                        unit: "meters",
                    },
                },
                {
                    id: "radius",
                    data: {
                        lat: 48.2,
                        lng: 16.37,
                        radius: 2,
                        unit: "kilometers",
                    },
                },
            ]),
        );

        const questions = questionsSchema.parse(saved);
        expect(questions[0].data).toMatchObject({
            radius: 5,
            unit: "kilometers",
        });
        expect(questions[1].data).toMatchObject({
            radius: 2,
            unit: "kilometers",
        });
    });

    it("names a question with a broken radius without failing", () => {
        const radar = questionSchema.parse({
            id: "radius",
            data: { lat: 48.2, lng: 16.37, radius: 2, unit: "kilometers" },
        });
        if (radar.id !== "radius") throw new Error("Not a radar");
        radar.data.radius = NaN;

        expect(questionTitle(radar)).toBe("Radar ?");
    });
});
