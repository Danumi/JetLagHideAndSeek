import * as turf from "@turf/turf";

import { type HiderLocation, mapGeoJSON, polyGeoJSON } from "@/lib/context";
import { t, tr } from "@/lib/i18n";
import { hiderifyQuestion } from "@/maps";
import { currentAnswer, formatKilometers } from "@/maps/answers";
import { determineMapBoundaries } from "@/maps/api";
import { matchingCardFor, measuringCardFor } from "@/maps/deck";
import { extractStationName } from "@/maps/geo-utils";
import {
    findNearest,
    nearestName,
    nearestTitle,
    nearestWhere,
} from "@/maps/nearest";
import { type Question, type TentacleQuestion } from "@/maps/schema";
import { chosenHiderStation, findHidingZoneStations } from "@/maps/stations";
import {
    findSubwayLines,
    nearestStation,
    seekersLine,
} from "@/maps/subwayLines";

/** Questions about the hider's station, the one of their chosen zone. */
export const STATION_TYPES = [
    "same-first-letter-station",
    "same-length-station",
    "same-train-line",
];

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
        return { value: "no-answer", reason: tr(card.noAnswer) };
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
            return t("reason.radar", {
                distance: formatKilometers(distance(question.data, you)),
            });
        case "thermometer":
            return t("reason.thermometer", {
                start: formatKilometers(
                    distance(
                        { lat: question.data.latA, lng: question.data.lngA },
                        you,
                    ),
                ),
                end: formatKilometers(
                    distance(
                        { lat: question.data.latB, lng: question.data.lngB },
                        you,
                    ),
                ),
            });
        case "matching":
        case "measuring":
            return explainNearest(question, you);
    }
};

/** "At your station Karlsplatz: U1, U2, U4. The seekers are riding the U3." */
const explainLine = async (
    question: { lat: number; lng: number; lineKey?: string },
    you: { lat: number; lng: number },
) => {
    const stations = (await findHidingZoneStations()) ?? [];
    const station =
        (await chosenHiderStation()) ?? nearestStation(stations, you);
    const lines = await findSubwayLines(stations);
    const { chosen } = seekersLine(lines, stations, question);
    if (!station || !chosen) return undefined;
    const yours = lines
        .filter((line) =>
            line.stationIds.includes(station.properties.id as string),
        )
        .map((line) => line.label);
    return t("reason.line", {
        station: extractStationName(station) ?? "",
        lines: yours.length > 0 ? yours.join(", ") : "–",
        line: chosen.label,
    });
};

/** What's nearest to the hider and to the seekers, worked out like on their map. */
const explainNearest = async (
    question: Question,
    you: { lat: number; lng: number },
) => {
    if (
        question.id === "matching" &&
        question.data.type === "same-train-line"
    ) {
        const reason = await explainLine(question.data, you);
        if (reason) return reason;
    }

    // Station questions are about the station of the hider's chosen zone
    if (
        question.id === "matching" &&
        STATION_TYPES.includes(question.data.type)
    ) {
        const station = await chosenHiderStation();
        const theirs = station && (await findNearest(question));
        if (station && theirs) {
            return t("reason.station", {
                you: nearestName({
                    kind: "distance",
                    what: "station",
                    name: extractStationName(station),
                    countCharacters: theirs.countCharacters,
                }),
                them: nearestName(theirs),
                themDistance: formatKilometers(theirs.kilometers ?? 0),
            });
        }
    }

    // One after the other: some servers take one query at a time
    const yours = await findNearest(question, you);
    const theirs = await findNearest(question);
    if (!yours || !theirs) return undefined;

    switch (yours.kind) {
        case "inside":
        case "on":
            return t("reason.inside", {
                you: nearestWhere(yours),
                them: nearestWhere(theirs),
            });
        case "border": {
            const card =
                question.id === "measuring"
                    ? measuringCardFor(question.data)
                    : undefined;
            return t("reason.border", {
                border: card ? tr(card.label) : yours.what,
                you: formatKilometers(yours.kilometers ?? 0),
                them: formatKilometers(theirs.kilometers ?? 0),
            });
        }
        case "elevation":
            return t("reason.elevation", {
                you: Math.round(yours.meters ?? 0),
                them: Math.round(theirs.meters ?? 0),
            });
        case "distance":
            return t("reason.distance", {
                nearest: nearestTitle(yours.what),
                you: nearestName(yours),
                youDistance: formatKilometers(yours.kilometers ?? 0),
                them: nearestName(theirs),
                themDistance: formatKilometers(theirs.kilometers ?? 0),
            });
        default:
            return undefined;
    }
};
