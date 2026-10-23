import * as turf from "@turf/turf";
import type { Feature, FeatureCollection } from "geojson";
import { atom } from "nanostores";

import { type HiderLocation, hiderMode } from "@/lib/context";

import { isPending, questionApplies } from "./answers";
import { OverpassError } from "./api/overpass";
import {
    adjustPerMatching,
    hiderifyMatching,
    matchingPlanningPolygon,
} from "./questions/matching";
import {
    adjustPerMeasuring,
    hiderifyMeasuring,
    measuringPlanningPolygon,
} from "./questions/measuring";
import {
    adjustPerRadius,
    hiderifyRadius,
    radiusPlanningPolygon,
} from "./questions/radius";
import {
    adjustPerTentacle,
    hiderifyTentacles,
    tentaclesPlanningPolygon,
} from "./questions/tentacles";
import {
    adjustPerThermometer,
    hiderifyThermometer,
    thermometerPlanningPolygon,
} from "./questions/thermometer";
import type { Question, Questions } from "./schema";

export * from "./answers";
export * from "./geo-utils";

/** Works out the hider's answer to an unlocked question (default: hider mode location). */
export const hiderifyQuestion = async (
    question: Question,
    hider: HiderLocation | false = hiderMode.get(),
) => {
    if (question.data.drag) {
        switch (question.id) {
            case "radius":
                question.data = await hiderifyRadius(question.data, hider);
                break;
            case "thermometer":
                question.data = await hiderifyThermometer(question.data, hider);
                break;
            case "tentacles":
                question.data = await hiderifyTentacles(question.data, hider);
                break;
            case "matching":
                question.data = await hiderifyMatching(question.data, hider);
                break;
            case "measuring":
                question.data = await hiderifyMeasuring(question.data, hider);
                break;
        }

        // The app worked out the hider's answer
        if (question.data.status === "pending") {
            question.data.status = "answered";
        }
    }

    return question;
};

/** Outline of what a question could rule out: for planning mode and pending questions. */
export const determinePlanningPolygon = async (
    question: Question,
    planningModeEnabled: boolean,
) => {
    if (
        ((planningModeEnabled && question.data.drag) || isPending(question)) &&
        !question.data.hidden
    ) {
        switch (question.id) {
            case "radius":
                return radiusPlanningPolygon(question.data);
            case "thermometer":
                return thermometerPlanningPolygon(question.data);
            case "tentacles":
                return tentaclesPlanningPolygon(question.data);
            case "matching":
                return matchingPlanningPolygon(question.data);
            case "measuring":
                return measuringPlanningPolygon(question.data);
        }
    }
};

/**
 * Questions whose map data didn't load because the servers didn't answer
 * (questions that depend on the location, like the nearest street): the map
 * leaves them out until "Retry", instead of waiting up to a minute for the
 * servers again after every answer. Their line in the log says so.
 */
export const questionsNotLoaded = atom<string[]>([]);

export const notLoadedKey = (question: { key: number; data: any }) =>
    JSON.stringify([
        question.key,
        question.data.lat,
        question.data.lng,
        question.data.type,
    ]);

/** "Retry": the map asks the servers again for the questions left out. */
export const retryQuestionsNotLoaded = () => questionsNotLoaded.set([]);

export async function adjustMapGeoDataForQuestion(
    question: any,
    mapGeoData: any,
) {
    if (
        question.data.hidden ||
        questionsNotLoaded.get().includes(notLoadedKey(question))
    ) {
        return mapGeoData;
    }

    try {
        switch (question?.id) {
            case "radius":
                return await adjustPerRadius(question.data, mapGeoData);
            case "thermometer":
                return await adjustPerThermometer(question.data, mapGeoData);
            case "tentacles":
                if (question.data.location === false) {
                    return adjustPerRadius(
                        { ...question.data, within: false },
                        mapGeoData,
                    );
                }
                return await adjustPerTentacle(question.data, mapGeoData);
            case "matching":
                return await adjustPerMatching(question.data, mapGeoData);
            case "measuring":
                return await adjustPerMeasuring(question.data, mapGeoData);
            default:
                return mapGeoData;
        }
    } catch (error) {
        if (error instanceof OverpassError) {
            questionsNotLoaded.set([
                ...questionsNotLoaded.get(),
                notLoadedKey(question),
            ]);
        }
        return mapGeoData;
    }
}

/** Less than this is left only where two answers meet. */
const NOTHING_LEFT_SQUARE_METERS = 100;

/**
 * Where the hider can still be after the answered questions; no features
 * when the answers leave nothing.
 */
export async function applyQuestionsToMapGeoData(
    questions: Questions,
    mapGeoData: any,
    planningModeEnabled: boolean,
    planningModeCallback?: (
        polygon: FeatureCollection | Feature,
        question: any,
    ) => void,
): Promise<any> {
    for (const question of questions) {
        if (planningModeCallback) {
            try {
                const planningPolygon = await determinePlanningPolygon(
                    question,
                    planningModeEnabled,
                );
                if (planningPolygon) {
                    planningModeCallback(planningPolygon, question);
                }
            } catch (error) {
                // An outline that can't be drawn shouldn't stop the map
                console.log(error);
            }
        }
        if (
            !questionApplies(question, planningModeEnabled) ||
            mapGeoData.features?.length === 0
        ) {
            continue;
        }

        mapGeoData = await adjustMapGeoDataForQuestion(question, mapGeoData);

        // Nothing left where the hider could be (at most a sliver along a
        // border): the answers contradict each other, e.g. after a wrong
        // answer button
        if (!mapGeoData || turf.area(mapGeoData) < NOTHING_LEFT_SQUARE_METERS) {
            mapGeoData = { type: "FeatureCollection", features: [] };
            continue;
        }

        if (mapGeoData.type !== "FeatureCollection") {
            mapGeoData = {
                type: "FeatureCollection",
                features: [mapGeoData],
            };
        }
    }
    return mapGeoData;
}
