import * as turf from "@turf/turf";

import { type HiderLocation, hiderMode } from "@/lib/context";
import { arcBuffer, arcDistance, modifyMapData } from "@/maps/geo-utils";
import type { RadiusQuestion } from "@/maps/schema";

export const adjustPerRadius = async (
    question: RadiusQuestion,
    mapData: any,
) => {
    if (mapData === null) return;

    const point = turf.point([question.lng, question.lat]);
    const circle = await arcBuffer(
        turf.featureCollection([point]),
        question.radius,
        question.unit,
    );

    return modifyMapData(mapData, circle, question.within);
};

export const hiderifyRadius = async (
    question: RadiusQuestion,
    $hiderMode: HiderLocation | false = hiderMode.get(),
) => {
    if ($hiderMode === false) {
        return question;
    }

    const distance = await arcDistance(
        turf.point([question.lng, question.lat]),
        turf.point([$hiderMode.longitude, $hiderMode.latitude]),
        question.unit,
    );

    if (distance <= question.radius) {
        question.within = true;
    } else {
        question.within = false;
    }

    return question;
};

export const radiusPlanningPolygon = async (question: RadiusQuestion) => {
    const point = turf.point([question.lng, question.lat]);
    const circle = await arcBuffer(
        turf.featureCollection([point]),
        question.radius,
        question.unit,
    );

    return turf.polygonToLine(circle);
};
