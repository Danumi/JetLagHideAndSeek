import * as turf from "@turf/turf";

import { type HiderLocation, mapGeoJSON, polyGeoJSON } from "@/lib/context";
import { hiderifyQuestion } from "@/maps";
import { currentAnswer, formatKilometers } from "@/maps/answers";
import { determineMapBoundaries } from "@/maps/api";
import { matchingCardFor, measuringCardFor } from "@/maps/deck";
import { findNearest } from "@/maps/nearest";
import { type Question, type TentacleQuestion } from "@/maps/schema";

/*
 * The hider's side of a question: the seekers send it as a link (see
 * questionLink.ts), the hider's phone works out the answer from the hider's
 * location.
 */

export type HiderAnswer = {
    /** An answer option's value, "no-answer", or "place" for tentacles. */
    value: string;
    /** Why, for the hider's eyes only: it can give away more than the answer. */
    reason?: string;
    /** Tentacles: the place the hider is nearest to, or false. */
    location?: TentacleQuestion["location"];
};

/** The hider's answer to a question, worked out like the seekers' map does. */
export const workOutAnswer = async (
    question: Question,
    hider: HiderLocation,
): Promise<HiderAnswer> => {
    const card =
        question.id === "matching"
            ? matchingCardFor(question.data)
            : question.id === "measuring"
              ? measuringCardFor(question.data)
              : undefined;
    if (card?.noAnswer) {
        return { value: "no-answer", reason: card.noAnswer };
    }

    // Zones and places are worked out within the game area
    if (!mapGeoJSON.get()) {
        mapGeoJSON.set(polyGeoJSON.get() ?? (await determineMapBoundaries()));
    }

    const answered = structuredClone(question);
    answered.data.drag = true;
    answered.data.status = "pending";
    await hiderifyQuestion(answered, hider);

    let reason: string | undefined;
    try {
        reason = await explainAnswer(answered, hider);
    } catch (error) {
        // The answer stands without a reason
        console.log(error);
    }

    if (answered.id === "tentacles") {
        return { value: "place", location: answered.data.location, reason };
    }
    return { value: currentAnswer(answered) ?? "no-answer", reason };
};

const distance = (
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
) =>
    turf.distance([from.lng, from.lat], [to.lng, to.lat], {
        units: "kilometers",
    });

/** One sentence on why the answer is what it is, where the app can tell. */
export const explainAnswer = async (
    question: Question,
    hider: HiderLocation,
): Promise<string | undefined> => {
    const you = { lat: hider.latitude, lng: hider.longitude };

    switch (question.id) {
        case "radius":
            return `You are ${formatKilometers(
                distance(question.data, you),
            )} from where the seekers asked.`;
        case "thermometer":
            return `You are ${formatKilometers(
                distance(
                    { lat: question.data.latA, lng: question.data.lngA },
                    you,
                ),
            )} from where the seekers started and ${formatKilometers(
                distance(
                    { lat: question.data.latB, lng: question.data.lngB },
                    you,
                ),
            )} from where they stopped.`;
        case "matching":
        case "measuring":
            return explainNearest(question, you);
    }
};

/** What's nearest to the hider and to the seekers, worked out like on their map. */
const explainNearest = async (
    question: Question,
    you: { lat: number; lng: number },
) => {
    // The map measures to the border of the seekers' zone, the hider's own
    // nearest border could be another one
    if (question.id === "measuring" && question.data.type === "admin-measure") {
        return undefined;
    }

    // One after the other: some servers take one query at a time
    const yours = await findNearest(question, you);
    const theirs = await findNearest(question);
    if (!yours || !theirs) return undefined;

    switch (yours.kind) {
        case "inside":
            return `You are in ${yours.label}, the seekers are in ${theirs.label}.`;
        case "on":
            return `You are on ${yours.label}, the seekers are on ${theirs.label}.`;
        case "elevation":
            return `You are ${Math.round(
                yours.meters ?? 0,
            )} m above sea level, the seekers ${Math.round(
                theirs.meters ?? 0,
            )} m.`;
        case "distance":
            return `Nearest ${yours.what} to you: ${yours.label}, ${formatKilometers(
                yours.kilometers ?? 0,
            )} away. To the seekers: ${theirs.label}, ${formatKilometers(
                theirs.kilometers ?? 0,
            )}.`;
        default:
            return undefined;
    }
};
