import { describe, expect, it } from "vitest";

import {
    answerOptions,
    answerText,
    isLogged,
    isPending,
    questionApplies,
    questionTitle,
    setAnswer,
    setNoAnswer,
} from "@/maps/answers";
import { questionSchema } from "@/maps/schema";

const radar = (data: Record<string, unknown> = {}) =>
    questionSchema.parse({
        id: "radius",
        data: { lat: 48.2, lng: 16.37, radius: 2, unit: "kilometers", ...data },
    });

describe("answers", () => {
    it("treats questions saved by older versions as answered", () => {
        const question = radar({ within: false });

        expect(question.data.status).toBe("answered");
        expect(questionApplies(question, false)).toBe(true);
        expect(answerText(question)).toBe("Outside");
    });

    it("keeps pending questions off the map", () => {
        const question = radar({ status: "pending" });

        expect(isPending(question)).toBe(true);
        expect(isLogged(question)).toBe(false);
        expect(questionApplies(question, false)).toBe(false);
        expect(answerText(question)).toBe("Waiting for answer");
    });

    it("applies and locks a question once answered", () => {
        const question = radar({ status: "pending" });

        setAnswer(question, "outside");

        expect(question.id === "radius" && question.data.within).toBe(false);
        expect(question.data.status).toBe("answered");
        expect(question.data.drag).toBe(false);
        expect(isLogged(question)).toBe(true);
        expect(questionApplies(question, false)).toBe(true);
    });

    it("doesn't change the map for questions without an answer", () => {
        const question = radar({ status: "pending" });

        setNoAnswer(question);

        expect(question.data.status).toBe("no-answer");
        expect(question.data.drag).toBe(false);
        expect(questionApplies(question, false)).toBe(false);
        expect(answerText(question)).toBe("No answer");
    });

    it("still skips unlocked questions in planning mode", () => {
        const question = radar();

        expect(question.data.drag).toBe(true);
        expect(questionApplies(question, true)).toBe(false);
    });

    it("offers different for the station name length", () => {
        const question = questionSchema.parse({
            id: "matching",
            data: {
                lat: 48.2,
                lng: 16.37,
                type: "same-length-station",
                status: "pending",
            },
        });

        expect(answerOptions(question).map((option) => option.value)).toEqual([
            "same",
            "different",
            "shorter",
            "longer",
        ]);

        setAnswer(question, "different");

        if (question.id !== "matching") throw new Error("wrong type");
        expect(question.data.lengthComparison).toBe("different");
        expect(question.data.same).toBe(false);
        expect(answerText(question)).toBe("Different");
    });

    it("names questions like the cards", () => {
        expect(questionTitle(radar())).toBe("Radar 2 km");
        expect(questionTitle(radar({ radius: 500, unit: "meters" }))).toBe(
            "Radar 500 m",
        );
        expect(
            questionTitle(
                questionSchema.parse({
                    id: "measuring",
                    data: { lat: 48.2, lng: 16.37, type: "museum-full" },
                }),
            ),
        ).toBe("Measuring: Museum");
    });
});
