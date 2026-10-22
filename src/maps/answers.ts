import * as turf from "@turf/turf";

import {
    matchingCardFor,
    measuringCardFor,
    radarDistanceFor,
} from "@/maps/deck";
import {
    determineUnionizedStrings,
    matchingQuestionSchema,
    measuringQuestionSchema,
    type Question,
    type Units,
} from "@/maps/schema";

/*
 * The hider's answer to a question: which buttons the seekers get, what each
 * one sets, and how an answered question reads in the question log.
 */

export type AnswerOption = { value: string; label: string };

/** Only answered questions change the map; pending ones show an outline. */
export const questionApplies = (
    question: Question,
    planningModeEnabled: boolean,
) =>
    (question.data.status ?? "answered") === "answered" &&
    !(planningModeEnabled && question.data.drag);

export const isPending = (question: Question) =>
    question.data.status === "pending";

/** Answered questions are locked and shown as one line in the question log. */
export const isLogged = (question: Question) =>
    question.data.status !== "pending" && !question.data.drag;

/** The answer buttons for a question, empty for tentacles (answered by place). */
export const answerOptions = (question: Question): AnswerOption[] => {
    switch (question.id) {
        case "radius":
            return [
                { value: "inside", label: "Inside" },
                { value: "outside", label: "Outside" },
            ];
        case "thermometer":
            return [
                { value: "warmer", label: "Warmer" },
                { value: "colder", label: "Colder" },
            ];
        case "measuring":
            return [
                { value: "closer", label: "Closer" },
                { value: "further", label: "Further" },
            ];
        case "matching":
            return question.data.type === "same-length-station"
                ? [
                      { value: "same", label: "Same" },
                      { value: "different", label: "Different" },
                      { value: "shorter", label: "Shorter" },
                      { value: "longer", label: "Longer" },
                  ]
                : [
                      { value: "same", label: "Same" },
                      { value: "different", label: "Different" },
                  ];
        default:
            return [];
    }
};

/** The answer currently set in the question's fields. */
export const currentAnswer = (question: Question): string | undefined => {
    switch (question.id) {
        case "radius":
            return question.data.within ? "inside" : "outside";
        case "thermometer":
            return question.data.warmer ? "warmer" : "colder";
        case "measuring":
            return question.data.hiderCloser ? "closer" : "further";
        case "matching":
            if (question.data.type === "same-length-station") {
                return (
                    question.data.lengthComparison ??
                    (question.data.same ? "same" : "different")
                );
            }
            return question.data.same ? "same" : "different";
        default:
            return undefined;
    }
};

/** Writes the hider's answer into the question and locks it. */
export const setAnswer = (question: Question, value: string) => {
    switch (question.id) {
        case "radius":
            question.data.within = value === "inside";
            break;
        case "thermometer":
            question.data.warmer = value === "warmer";
            break;
        case "measuring":
            question.data.hiderCloser = value === "closer";
            break;
        case "matching":
            if (question.data.type === "same-length-station") {
                question.data.lengthComparison = value as
                    | "same"
                    | "different"
                    | "shorter"
                    | "longer";
            }
            question.data.same = value === "same";
            break;
    }
    question.data.status = "answered";
    question.data.drag = false;
};

/** The hider can't answer this question: it doesn't change the map. */
export const setNoAnswer = (question: Question) => {
    question.data.status = "no-answer";
    question.data.drag = false;
};

export const answerText = (question: Question) => {
    if (question.data.status === "pending") return "Waiting for answer";
    if (question.data.status === "no-answer") return "No answer";
    if (question.id === "tentacles") {
        return question.data.location
            ? String(question.data.location.properties?.name ?? "Place")
            : "Not within";
    }
    const value = currentAnswer(question);
    return (
        answerOptions(question).find((option) => option.value === value)
            ?.label ?? ""
    );
};

const typeLabels = (schema: { options: readonly any[] }) =>
    Object.fromEntries(
        schema.options
            .flatMap((x) => determineUnionizedStrings(x.shape.type))
            .map((x) => [(x._def as any).value, x.description as string]),
    ) as Record<string, string>;

const MATCHING_TYPE_LABELS = typeLabels(matchingQuestionSchema);
const MEASURING_TYPE_LABELS = typeLabels(measuringQuestionSchema);

export const formatKilometers = (kilometers: number) =>
    kilometers < 1
        ? `${Math.round(kilometers * 1000)} m`
        : `${Number(kilometers.toFixed(1))} km`;

const formatRadius = (radius: number, unit: Units) =>
    Number.isFinite(radius) && radius >= 0
        ? formatKilometers(turf.convertLength(radius, unit, "kilometers"))
        : "?";

/** Short name of the question, like "Radar 2 km" or "Matching: Museum". */
export const questionTitle = (question: Question) => {
    switch (question.id) {
        case "radius":
            return `Radar ${
                radarDistanceFor(question.data)?.label ??
                formatRadius(question.data.radius, question.data.unit)
            }`;
        case "thermometer":
            return `Thermometer ${formatKilometers(
                turf.distance(
                    [question.data.lngA, question.data.latA],
                    [question.data.lngB, question.data.latB],
                    { units: "kilometers" },
                ),
            )}`;
        case "tentacles":
            return `Tentacles ${formatRadius(
                question.data.radius,
                question.data.unit,
            )}`;
        case "matching":
            return `Matching: ${
                matchingCardFor(question.data)?.label ??
                MATCHING_TYPE_LABELS[question.data.type] ??
                question.data.type
            }`;
        case "measuring":
            return `Measuring: ${
                measuringCardFor(question.data)?.label ??
                MEASURING_TYPE_LABELS[question.data.type] ??
                question.data.type
            }`;
    }
};

/** Clock time the question was asked, like "14:32". */
export const askedAtText = (question: Question) =>
    question.data.askedAt
        ? new Date(question.data.askedAt).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
          })
        : undefined;
