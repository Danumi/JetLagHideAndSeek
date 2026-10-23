import * as turf from "@turf/turf";

import { formatNumber, labelOf, type MessageKey, t, tr } from "@/lib/i18n";
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

const option = (value: string): AnswerOption => ({
    value,
    label: t(`answer.${value}` as MessageKey),
});

/**
 * Only answered questions change the map, unless hidden on it (also the
 * answers before the Move card); pending ones show an outline.
 */
export const questionApplies = (
    question: Question,
    planningModeEnabled: boolean,
) =>
    (question.data.status ?? "answered") === "answered" &&
    !question.data.hidden &&
    !(planningModeEnabled && question.data.drag);

export const isPending = (question: Question) =>
    question.data.status === "pending";

/**
 * Sent to the hider and not being changed: the hider has this version, so
 * the question stays as it is ("Change and send again" opens it).
 */
export const isSentLocked = (question: Question) =>
    isPending(question) &&
    question.data.sentAt !== undefined &&
    !question.data.drag;

/**
 * "Send to hider" locks the question. The hider's time starts with the
 * first link, and again with the link of a changed question.
 */
export const markSent = (question: Question) => {
    if (question.data.sentAt === undefined || question.data.drag) {
        question.data.sentAt = Date.now();
    }
    question.data.drag = false;
};

/** "Change and send again": the question opens until it is sent again. */
export const changeSent = (question: Question) => {
    question.data.drag = true;
};

/** Answered questions are locked and shown as one line in the question log. */
export const isLogged = (question: Question) =>
    question.data.status !== "pending" && !question.data.drag;

/** The answer buttons for a question, empty for tentacles (answered by place). */
export const answerOptions = (question: Question): AnswerOption[] => {
    switch (question.id) {
        case "radius":
            return [option("inside"), option("outside")];
        case "thermometer":
            return [option("warmer"), option("colder")];
        case "measuring":
            return [option("closer"), option("further")];
        // The station name length too: only the same length or not, as in
        // the rule book (old questions may still say shorter or longer)
        case "matching":
            return [option("same"), option("different")];
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
    if (question.data.status === "pending") return t("answer.waiting");
    if (question.data.status === "no-answer") return t("answer.none");
    if (question.id === "tentacles") {
        return question.data.location
            ? String(
                  question.data.location.properties?.name ?? t("answer.place"),
              )
            : t("answer.notWithin");
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

/** "350 m", "1.2 km" (German: "1,2 km"). */
export const formatKilometers = (kilometers: number) =>
    kilometers < 1
        ? `${Math.round(kilometers * 1000)} m`
        : `${formatNumber(kilometers)} km`;

const formatRadius = (radius: number, unit: Units) =>
    Number.isFinite(radius) && radius >= 0
        ? formatKilometers(turf.convertLength(radius, unit, "kilometers"))
        : "?";

/** How far apart the start and end of a thermometer are, as the crow flies. */
export const thermometerTraveled = (data: {
    latA: number;
    lngA: number;
    latB: number;
    lngB: number;
}) =>
    turf.distance([data.lngA, data.latA], [data.lngB, data.latB], {
        units: "kilometers",
    });

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
                question.data.distance ?? thermometerTraveled(question.data),
            )}`;
        case "tentacles":
            return `${t("kind.tentacles")} ${formatRadius(
                question.data.radius,
                question.data.unit,
            )}`;
        case "matching": {
            const card = matchingCardFor(question.data);
            return `Matching: ${
                card
                    ? tr(card.label)
                    : labelOf(
                          MATCHING_TYPE_LABELS[question.data.type] ??
                              question.data.type,
                      )
            }`;
        }
        case "measuring": {
            const card = measuringCardFor(question.data);
            return `Measuring: ${
                card
                    ? tr(card.label)
                    : labelOf(
                          MEASURING_TYPE_LABELS[question.data.type] ??
                              question.data.type,
                      )
            }`;
        }
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
