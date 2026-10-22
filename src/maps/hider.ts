import * as turf from "@turf/turf";

import { type HiderLocation, mapGeoJSON, polyGeoJSON } from "@/lib/context";
import { hiderifyQuestion } from "@/maps";
import { currentAnswer, formatKilometers } from "@/maps/answers";
import {
    type APILocations,
    determineMapBoundaries,
    elevationAt,
    findNearestStreet,
    findPlacesOfKind,
    prettifyLocation,
    type StationPlace,
} from "@/maps/api";
import { matchingCardFor, measuringCardFor } from "@/maps/deck";
import { extractStationName } from "@/maps/geo-utils";
import { findAdminZoneInfo } from "@/maps/questions/measuring";
import {
    type MatchingQuestion,
    type MeasuringQuestion,
    type Question,
    type TentacleQuestion,
} from "@/maps/schema";
import { findHidingZoneStations, findStationPlaces } from "@/maps/stations";

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

/** The nearest of `features` (each a `what`, like "park") to a point. */
const nearestOf = (
    features: { name?: string; lat: number; lng: number }[],
    to: { lat: number; lng: number },
    what: string,
) => {
    let best: { name: string; kilometers: number } | null = null;
    for (const feature of features) {
        const kilometers = distance(feature, to);
        if (!best || kilometers < best.kilometers) {
            best = { name: feature.name || `an unnamed ${what}`, kilometers };
        }
    }
    return best;
};

const placesOfKind = async (location: APILocations) =>
    (await findPlacesOfKind(location)).elements.map((x: any) => ({
        name: x.tags?.name as string | undefined,
        lat: x.center ? x.center.lat : x.lat,
        lng: x.center ? x.center.lon : x.lon,
    }));

const stationPoints = (stations: StationPlace[]) =>
    stations.map((station) => ({
        name: extractStationName(station) as string | undefined,
        lat: station.geometry.coordinates[1],
        lng: station.geometry.coordinates[0],
    }));

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
            return explainMatching(question.data, you);
        case "measuring":
            return explainMeasuring(question.data, you);
    }
};

const explainMatching = async (
    question: MatchingQuestion,
    you: { lat: number; lng: number },
) => {
    if (question.type.endsWith("-full")) {
        const location = question.type.split("-full")[0] as APILocations;
        const what = prettifyLocation(location).toLowerCase();
        const places = await placesOfKind(location);
        const yours = nearestOf(places, you, what);
        const theirs = nearestOf(places, question, what);
        if (!yours || !theirs) return undefined;
        return `Nearest ${what} to you: ${yours.name}. To the seekers: ${theirs.name}.`;
    }

    switch (question.type) {
        case "same-first-letter-station":
        case "same-length-station":
        case "same-train-line": {
            const stations = stationPoints(await findStationPlaces());
            const yours = nearestOf(stations, you, "station");
            const theirs = nearestOf(stations, question, "station");
            if (!yours || !theirs) return undefined;
            if (question.type === "same-length-station") {
                return `Your nearest station: ${yours.name} (${yours.name.length} characters). The seekers': ${theirs.name} (${theirs.name.length} characters).`;
            }
            return `Your nearest station: ${yours.name}. The seekers': ${theirs.name}.`;
        }
        case "street": {
            const yours = await findNearestStreet(you.lat, you.lng);
            const theirs = await findNearestStreet(question.lat, question.lng);
            if (!yours || !theirs) return undefined;
            return `Nearest street to you: ${
                yours.name ?? "an unnamed path"
            }. To the seekers: ${theirs.name ?? "an unnamed path"}.`;
        }
        case "zone":
        case "letter-zone": {
            const yours = await findAdminZoneInfo(
                you.lat,
                you.lng,
                question.cat.adminLevel,
            );
            const theirs = await findAdminZoneInfo(
                question.lat,
                question.lng,
                question.cat.adminLevel,
            );
            if (!yours || !theirs) return undefined;
            // German names, as on the signs
            const name = (zone: typeof yours) =>
                zone.boundary.properties?.name ?? zone.name;
            return `You are in ${name(yours)}, the seekers are in ${name(
                theirs,
            )}.`;
        }
    }
};

const explainMeasuring = async (
    question: MeasuringQuestion,
    you: { lat: number; lng: number },
) => {
    const nearestBoth = (
        what: string,
        places: { name?: string; lat: number; lng: number }[],
    ) => {
        const yours = nearestOf(places, you, what);
        const theirs = nearestOf(places, question, what);
        if (!yours || !theirs) return undefined;
        return `Nearest ${what} to you: ${yours.name}, ${formatKilometers(
            yours.kilometers,
        )} away. To the seekers: ${theirs.name}, ${formatKilometers(
            theirs.kilometers,
        )}.`;
    };

    if (question.type.endsWith("-full")) {
        const location = question.type.split("-full")[0] as APILocations;
        return nearestBoth(
            prettifyLocation(location).toLowerCase(),
            await placesOfKind(location),
        );
    }

    switch (question.type) {
        case "rail-measure": {
            const stations = await findHidingZoneStations();
            if (!stations) return undefined;
            return nearestBoth("station", stationPoints(stations));
        }
        case "sea-level": {
            const yours = await elevationAt(you.lat, you.lng);
            const theirs = await elevationAt(question.lat, question.lng);
            if (yours === null || theirs === null) return undefined;
            return `You are ${Math.round(
                yours,
            )} m above sea level, the seekers ${Math.round(theirs)} m.`;
        }
    }
};
