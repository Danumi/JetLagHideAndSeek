import * as turf from "@turf/turf";
import type { Feature, MultiPolygon } from "geojson";
import _ from "lodash";
import osmtogeojson from "osmtogeojson";
import { toast } from "react-toastify";

import {
    allTrainStations,
    hiderMode,
    mapGeoJSON,
    mapGeoLocation,
    polyGeoJSON,
    trainStations,
} from "@/lib/context";
import {
    elevationAt,
    fetchCoastline,
    findAdminBoundary,
    findNamedWaterLines,
    findPlacesInZone,
    findPlacesSpecificInZone,
    LOCATION_FIRST_TAG,
    MAX_PLACES_IN_ZONE,
    nearestToQuestion,
    prettifyLocation,
    QuestionSpecificLocation,
    regionLowerThan,
} from "@/maps/api";
import {
    arcBufferToPoint,
    arcDistance,
    connectToSeparateLines,
    groupObjects,
    holedMask,
    modifyMapData,
} from "@/maps/geo-utils";
import type {
    APILocations,
    HomeGameMeasuringQuestions,
    MeasuringQuestion,
} from "@/maps/schema";

export interface AdminZoneInfo {
    name: string;
    boundary: any;
}

export const findAdminZoneInfo = _.memoize(
    async (
        lat: number,
        lng: number,
        adminLevel: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
    ): Promise<AdminZoneInfo | null> => {
        const boundary = await findAdminBoundary(lat, lng, adminLevel);

        if (!boundary) {
            return null;
        }

        const name =
            boundary.properties?.["name:en"] ??
            boundary.properties?.name ??
            "Unknown";

        return { name, boundary };
    },
    (lat, lng, adminLevel) =>
        `${lat.toFixed(6)},${lng.toFixed(6)},${adminLevel}`,
);

const highSpeedBase = _.memoize(
    (features: Feature[]) => {
        const grouped = groupObjects(features);

        const neighbored = grouped
            .map((group) => {
                return turf.multiLineString(
                    connectToSeparateLines(
                        group
                            .filter((x) => turf.getType(x) === "LineString")
                            .map((x) => x.geometry.coordinates),
                    ),
                );
            })
            .filter((x) => x.geometry.coordinates.length > 0);

        return turf.combine(
            turf.buffer(
                turf.simplify(turf.featureCollection(neighbored), {
                    tolerance: 0.001,
                }),
                0.001,
            )!,
        ).features[0];
    },
    (features) => `${JSON.stringify(features.map((x) => x.geometry))}`,
);

const bboxExtension = (
    bBox: [number, number, number, number],
    distance: number,
): [number, number, number, number] => {
    const buffered = turf.bbox(
        turf.buffer(turf.bboxPolygon(bBox), Math.abs(distance), {
            units: "miles",
        })!,
    );

    const originalDeltaLat = bBox[3] - bBox[1];
    const originalDeltaLng = bBox[2] - bBox[0];

    return [
        buffered[0] - originalDeltaLng,
        buffered[1] - originalDeltaLat,
        buffered[2] + originalDeltaLng,
        buffered[3] + originalDeltaLat,
    ];
};

const pointsOrNothing = (elements: any[], what: string) => {
    if (elements.length === 0) {
        toast.info(
            `No ${what} inside the game area. By the rules the question has no answer, but it still counts.`,
            { toastId: `no-places-${what}` },
        );
        return false as const;
    }
    return [
        turf.combine(
            turf.featureCollection(
                elements.map((x: any) =>
                    turf.point([
                        x.center ? x.center.lon : x.lon,
                        x.center ? x.center.lat : x.lat,
                    ]),
                ),
            ),
        ).features[0],
    ];
};

export const determineMeasuringBoundary = async (
    question: MeasuringQuestion,
) => {
    const bBox = turf.bbox(mapGeoJSON.get()!);

    switch (question.type) {
        case "highspeed-measure-shinkansen": {
            const features = osmtogeojson(
                await findPlacesInZone(
                    "[highspeed=yes]",
                    "Finding high-speed lines...",
                    "nwr",
                    "geom",
                ),
            ).features;

            return [highSpeedBase(features)];
        }
        case "admin-measure": {
            const adminLevel = (question as any).cat?.adminLevel ?? 4;
            const zoneInfo = await findAdminZoneInfo(
                question.lat,
                question.lng,
                adminLevel,
            );

            if (!zoneInfo) {
                toast.error("No admin boundary found at this location");
                return [turf.multiPolygon([])];
            }

            // Store the zone name for display
            if (!(question as any).cat) {
                (question as any).cat = { adminLevel };
            }
            (question as any).cat.zoneName = zoneInfo.name;

            // Convert the polygon to its outline (the border)
            const outline = turf.polygonToLine(zoneInfo.boundary);
            return [outline];
        }
        case "coastline": {
            const coastline = turf.lineToPolygon(
                await fetchCoastline(),
            ) as Feature<MultiPolygon>;

            const distanceToCoastline = turf.pointToPolygonDistance(
                turf.point([question.lng, question.lat]),
                coastline,
                {
                    units: "miles",
                    method: "geodesic",
                },
            );

            return [
                turf.difference(
                    turf.featureCollection([
                        turf.bboxPolygon(bBox),
                        turf.buffer(
                            turf.bboxClip(
                                coastline,
                                bBox
                                    ? bboxExtension(
                                          bBox as any,
                                          distanceToCoastline,
                                      )
                                    : [-180, -90, 180, 90],
                            ),
                            distanceToCoastline,
                            {
                                units: "miles",
                                steps: 64,
                            },
                        )!,
                    ]),
                )!,
            ];
        }
        case "airport":
            return pointsOrNothing(
                _.uniqBy(
                    (
                        await findPlacesInZone(
                            '["aeroway"="aerodrome"]["iata"]', // Only commercial airports have IATA codes,
                            "Finding airports...",
                        )
                    ).elements,
                    (feature: any) => feature.tags.iata,
                ),
                "commercial airports",
            );
        case "city":
            return pointsOrNothing(
                (
                    await findPlacesInZone(
                        '[place=city]["population"~"^[1-9]+[0-9]{6}$"]', // The regex is faster than (if:number(t["population"])>1000000)
                        "Finding cities...",
                    )
                ).elements,
                "major cities",
            );
        case "water": {
            const lines = await findNamedWaterLines();
            if (lines.length === 0) {
                toast.info(
                    "No named bodies of water inside the game area. By the rules the question has no answer, but it still counts.",
                    { toastId: "no-water" },
                );
                return false;
            }
            return [
                turf.combine(
                    turf.featureCollection(
                        lines.map((line) =>
                            turf.simplify(line, { tolerance: 0.0001 }),
                        ),
                    ),
                ).features[0],
            ];
        }
        case "sea-level":
            // Handled in bufferedDeterminer: it is not a distance buffer.
            return false;
        case "aquarium-full":
        case "zoo-full":
        case "theme_park-full":
        case "peak-full":
        case "museum-full":
        case "hospital-full":
        case "cinema-full":
        case "library-full":
        case "golf_course-full":
        case "consulate-full":
        case "park-full": {
            const location = question.type.split("-full")[0] as APILocations;

            const data = await findPlacesInZone(
                `[${LOCATION_FIRST_TAG[location]}=${location}]`,
                `Finding ${prettifyLocation(location, true).toLowerCase()}...`,
                "nwr",
                "center",
                [],
                60,
            );

            if (data.remark && data.remark.startsWith("runtime error")) {
                toast.error(
                    `Error finding ${prettifyLocation(
                        location,
                        true,
                    ).toLowerCase()}. Please enable hiding zone mode and switch to the Large Game variation of this question.`,
                );
                return [turf.multiPolygon([])];
            }

            if (data.elements.length >= MAX_PLACES_IN_ZONE) {
                toast.error(
                    `Too many ${prettifyLocation(
                        location,
                        true,
                    ).toLowerCase()} found (${data.elements.length}). Please enable hiding zone mode and switch to the Large Game variation of this question.`,
                );
                return [turf.multiPolygon([])];
            }

            return pointsOrNothing(
                data.elements,
                prettifyLocation(location, true).toLowerCase(),
            );
        }
        case "custom-measure":
            return turf.combine(
                turf.featureCollection((question as any).geo.features),
            ).features;
        case "aquarium":
        case "zoo":
        case "theme_park":
        case "peak":
        case "museum":
        case "hospital":
        case "cinema":
        case "library":
        case "golf_course":
        case "consulate":
        case "park":
        case "mcdonalds":
        case "seven11":
        case "rail-measure":
            return false;
    }
};

const seaLevelRegion = async (question: MeasuringQuestion) => {
    const elevation = await elevationAt(question.lat, question.lng);
    if (elevation === null) {
        toast.error("Could not load elevation data");
        return false;
    }
    toast.info(
        `Seekers' elevation: ${Math.round(elevation)} m above sea level`,
        {
            toastId: "sea-level",
        },
    );
    const region = await regionLowerThan(
        turf.bbox(mapGeoJSON.get()!) as [number, number, number, number],
        elevation,
    );
    if (region === null) {
        toast.error("Could not load elevation data");
        return false;
    }
    // Nothing in the game area is lower than the seekers.
    if (region.geometry.coordinates.length === 0) {
        return turf.multiPolygon([]);
    }
    return region;
};

const bufferedDeterminer = _.memoize(
    async (question: MeasuringQuestion) => {
        if (question.type === "sea-level") return seaLevelRegion(question);

        const placeData = await determineMeasuringBoundary(question);

        if (placeData === false || placeData === undefined) return false;

        return arcBufferToPoint(
            turf.featureCollection(placeData as any),
            question.lat,
            question.lng,
        );
    },
    (question) =>
        JSON.stringify({
            type: question.type,
            lat: question.lat,
            lng: question.lng,
            entirety: polyGeoJSON.get()
                ? polyGeoJSON.get()
                : mapGeoLocation.get(),
            geo: (question as any).geo,
            cat: (question as any).cat,
        }),
);

export const adjustPerMeasuring = async (
    question: MeasuringQuestion,
    mapData: any,
) => {
    if (mapData === null) return;

    const buffer = await bufferedDeterminer(question);

    if (buffer === false) return mapData;

    return modifyMapData(mapData, buffer, question.hiderCloser);
};

export const hiderifyMeasuring = async (question: MeasuringQuestion) => {
    const $hiderMode = hiderMode.get();
    if ($hiderMode === false) {
        return question;
    }

    if (
        [
            "aquarium",
            "zoo",
            "theme_park",
            "peak",
            "museum",
            "hospital",
            "cinema",
            "library",
            "golf_course",
            "consulate",
            "park",
        ].includes(question.type)
    ) {
        const questionNearest = await nearestToQuestion(
            question as HomeGameMeasuringQuestions,
        );
        const hiderNearest = await nearestToQuestion({
            lat: $hiderMode.latitude,
            lng: $hiderMode.longitude,
            hiderCloser: true,
            type: (question as HomeGameMeasuringQuestions).type,
            drag: false,
            color: "black",
            collapsed: false,
        });

        question.hiderCloser =
            questionNearest.properties.distanceToPoint >
            hiderNearest.properties.distanceToPoint;

        return question;
    }

    if (question.type === "sea-level") {
        const [seeker, hider] = await Promise.all([
            elevationAt(question.lat, question.lng),
            elevationAt($hiderMode.latitude, $hiderMode.longitude),
        ]);
        if (seeker !== null && hider !== null) {
            question.hiderCloser = hider < seeker;
        }
        return question;
    }

    if (question.type === "rail-measure") {
        const stations = trainStations.get();
        const allStations = allTrainStations.get();

        if (stations.length === 0) {
            return question;
        }

        const location = turf.point([question.lng, question.lat]);

        const nearestTrainStation = turf.nearestPoint(
            location,
            turf.featureCollection(
                allStations.length > 0
                    ? allStations
                    : stations.map((x) => x.properties),
            ) as any,
        );

        const distance = await arcDistance(location, nearestTrainStation);

        const hider = turf.point([$hiderMode.longitude, $hiderMode.latitude]);

        const hiderNearest = turf.nearestPoint(
            hider,
            turf.featureCollection(
                allStations.length > 0
                    ? allStations
                    : stations.map((x) => x.properties),
            ) as any,
        );

        const hiderDistance = await arcDistance(hider, hiderNearest);

        question.hiderCloser = hiderDistance < distance;
    }

    if (question.type === "mcdonalds" || question.type === "seven11") {
        const points = await findPlacesSpecificInZone(
            question.type === "mcdonalds"
                ? QuestionSpecificLocation.McDonalds
                : QuestionSpecificLocation.Seven11,
        );

        const seeker = turf.point([question.lng, question.lat]);
        const nearest = turf.nearestPoint(seeker, points as any);

        const distance = await arcDistance(seeker, nearest, "miles");

        const hider = turf.point([$hiderMode.longitude, $hiderMode.latitude]);
        const hiderNearest = turf.nearestPoint(hider, points as any);

        const hiderDistance = await arcDistance(hider, hiderNearest, "miles");

        question.hiderCloser = hiderDistance < distance;
        return question;
    }

    const $mapGeoJSON = mapGeoJSON.get();
    if ($mapGeoJSON === null) return question;

    let feature = null;

    try {
        feature = holedMask((await adjustPerMeasuring(question, $mapGeoJSON))!);
    } catch {
        try {
            feature = await adjustPerMeasuring(question, {
                type: "FeatureCollection",
                features: [holedMask($mapGeoJSON)],
            });
        } catch {
            return question;
        }
    }

    if (feature === null || feature === undefined) return question;

    const hiderPoint = turf.point([$hiderMode.longitude, $hiderMode.latitude]);

    if (turf.booleanPointInPolygon(hiderPoint, feature)) {
        question.hiderCloser = !question.hiderCloser;
    }

    return question;
};

export const measuringPlanningPolygon = async (question: MeasuringQuestion) => {
    try {
        const buffered = await bufferedDeterminer(question);

        if (buffered === false) return false;

        return turf.polygonToLine(buffered);
    } catch {
        return false;
    }
};
