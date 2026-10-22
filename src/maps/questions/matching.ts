import * as turf from "@turf/turf";
import type {
    Feature,
    FeatureCollection,
    MultiPolygon,
    Point,
    Polygon,
} from "geojson";
import _ from "lodash";
import osmtogeojson from "osmtogeojson";
import { toast } from "react-toastify";

import {
    displayHidingZonesOptions,
    hiderMode,
    mapGeoJSON,
    mapGeoLocation,
    polyGeoJSON,
} from "@/lib/context";
import { memoizeAsync } from "@/lib/utils";
import {
    findAdminBoundary,
    findLandmassIslands,
    findNearestStreet,
    findPlacesInZone,
    findPlacesOfKind,
    findStreetLines,
    MAX_PLACES_IN_ZONE,
    nearestToQuestion,
    prettifyLocation,
    trainLineNodeFinder,
} from "@/maps/api";
import {
    extractStationName,
    holedMask,
    modifyMapData,
    nearestVoronoiCell,
    safeUnion,
} from "@/maps/geo-utils";
import type {
    APILocations,
    HomeGameMatchingQuestions,
    MatchingQuestion,
} from "@/maps/schema";

export const findMatchingPlaces = async (question: MatchingQuestion) => {
    switch (question.type) {
        case "airport": {
            return _.uniqBy(
                (
                    await findPlacesInZone(
                        '["aeroway"="aerodrome"]["iata"]', // Only commercial airports have IATA codes,
                        "Finding airports...",
                    )
                ).elements,
                (feature: any) => feature.tags.iata,
            ).map((x) =>
                turf.point([
                    x.center ? x.center.lon : x.lon,
                    x.center ? x.center.lat : x.lat,
                ]),
            );
        }
        case "major-city": {
            return (
                await findPlacesInZone(
                    '[place=city]["population"~"^[1-9]+[0-9]{6}$"]', // The regex is faster than (if:number(t["population"])>1000000)
                    "Finding cities...",
                )
            ).elements.map((x: any) =>
                turf.point([
                    x.center ? x.center.lon : x.lon,
                    x.center ? x.center.lat : x.lat,
                ]),
            );
        }
        case "custom-points": {
            return question.geo!;
        }
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

            const data = await findPlacesOfKind(location);

            if (data.elements.length >= MAX_PLACES_IN_ZONE) {
                toast.error(
                    `Too many ${prettifyLocation(
                        location,
                        true,
                    ).toLowerCase()} found (${data.elements.length}). Please enable hiding zone mode and switch to the Large Game variation of this question.`,
                );
                return [];
            }

            return data.elements.map((x: any) =>
                turf.point([
                    x.center ? x.center.lon : x.lon,
                    x.center ? x.center.lat : x.lat,
                ]),
            );
        }
    }
};

export const determineMatchingBoundary = memoizeAsync(
    async (question: MatchingQuestion) => {
        let boundary;

        switch (question.type) {
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
            case "same-first-letter-station":
            case "same-length-station":
            case "same-train-line": {
                return false;
            }
            case "custom-zone": {
                boundary = question.geo;
                break;
            }
            case "zone": {
                boundary = await findAdminBoundary(
                    question.lat,
                    question.lng,
                    question.cat.adminLevel,
                );

                if (!boundary) {
                    toast.error("No boundary found for this zone");
                    throw new Error("No boundary found");
                }
                break;
            }
            case "letter-zone": {
                const zone = await findAdminBoundary(
                    question.lat,
                    question.lng,
                    question.cat.adminLevel,
                );

                if (!zone) {
                    toast.error("No boundary found for this zone");
                    throw new Error("No boundary found");
                }

                let englishName = zone.properties?.["name:en"];

                if (!englishName) {
                    const name = zone.properties?.name;

                    if (/^[a-zA-Z]$/.test(name[0])) {
                        englishName = name;
                    } else {
                        toast.error("No English name found for this zone");
                        throw new Error("No English name");
                    }
                }

                const letter = englishName[0].toUpperCase();

                boundary = turf.featureCollection(
                    osmtogeojson(
                        await findPlacesInZone(
                            `[admin_level=${question.cat.adminLevel}]["name:en"~"^${letter}.+"]`, // Regex is faster than filtering afterward
                            `Finding zones that start with the same letter (${letter})...`,
                            "relation",
                            "geom",
                            [
                                `[admin_level=${question.cat.adminLevel}]["name"~"^${letter}.+"]`,
                            ], // Regex is faster than filtering afterward
                        ),
                    ).features.filter(
                        (x): x is Feature<Polygon | MultiPolygon> =>
                            x.geometry &&
                            (x.geometry.type === "Polygon" ||
                                x.geometry.type === "MultiPolygon"),
                    ),
                );

                // It's either simplify or crash. Technically this could be bad if someone's hiding zone was inside multiple zones, but that's unlikely.
                boundary = safeUnion(
                    turf.simplify(boundary, {
                        tolerance: 0.001,
                        highQuality: true,
                        mutate: true,
                    }),
                );

                break;
            }
            case "street": {
                const street = await findNearestStreet(
                    question.lat,
                    question.lng,
                );
                if (!street) {
                    toast.error("No street or path found near the seekers");
                    return false;
                }
                toast.info(
                    `Seekers' nearest street or path: ${street.name ?? "unnamed path"}`,
                    { toastId: "street-name" },
                );
                if (!question.same) {
                    // Only points right on the street are certainly nearer to
                    // it than to any other street, so "different" can't
                    // reliably rule anything out.
                    return false;
                }
                const lines = street.name
                    ? await findStreetLines(street.name)
                    : [street.line];
                if (lines.length === 0) lines.push(street.line);
                // Anyone whose nearest street is this one is close to it.
                // 200 m is generous: streets and paths are much denser.
                boundary = turf.buffer(
                    turf.combine(
                        turf.featureCollection(
                            lines.map((line) =>
                                turf.simplify(line, { tolerance: 0.00005 }),
                            ),
                        ),
                    ).features[0],
                    200,
                    { units: "meters" },
                );
                break;
            }
            case "landmass": {
                const islands = await findLandmassIslands();
                if (islands.length === 0) {
                    toast.info(
                        "There are no separate landmasses in the game area. The map doesn't change.",
                        { toastId: "no-landmass" },
                    );
                    return false;
                }
                const point = turf.point([question.lng, question.lat]);
                const island = islands.find((feature) =>
                    turf.booleanPointInPolygon(point, feature),
                );
                if (island) {
                    toast.info(
                        `Seekers are on ${island.properties?.name ?? "an island"}`,
                        { toastId: "landmass-name" },
                    );
                    boundary = island;
                } else {
                    // Seekers are on the mainland: everything except the islands.
                    const everything = turf.bboxPolygon(
                        turf.bbox(
                            mapGeoJSON.get() ?? turf.featureCollection(islands),
                        ),
                    );
                    boundary = turf.difference(
                        turf.featureCollection([
                            everything,
                            safeUnion(turf.featureCollection(islands)),
                        ]),
                    );
                }
                break;
            }
            case "airport":
            case "major-city":
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
            case "park-full":
            case "custom-points": {
                const data = await findMatchingPlaces(question);

                if (!data || data.length === 0) {
                    toast.info(
                        "None of these places are inside the game area. By the rules the question has no answer, but it still counts.",
                        { toastId: `no-places-${question.type}` },
                    );
                    return false;
                }
                if (data.length === 1) {
                    toast.info(
                        "Only one of these places is inside the game area, so everyone's nearest one is the same. The map doesn't change.",
                        { toastId: `one-place-${question.type}` },
                    );
                    return false;
                }

                // The seekers' cell is the one of their nearest place.
                // Searching all cells for the seekers can hit a broken one.
                boundary = nearestVoronoiCell(
                    data,
                    turf.point([question.lng, question.lat]),
                );
                break;
            }
        }

        return boundary;
    },
    (question: MatchingQuestion & { geo?: unknown; cat?: unknown }) =>
        JSON.stringify({
            type: question.type,
            lat: question.lat,
            lng: question.lng,
            cat: question.cat,
            geo: question.geo,
            same: question.type === "street" ? question.same : undefined,
            entirety: polyGeoJSON.get()
                ? polyGeoJSON.get()
                : mapGeoLocation.get(),
        }),
);

export const adjustPerMatching = async (
    question: MatchingQuestion,
    mapData: any,
) => {
    if (mapData === null) return;

    const boundary = await determineMatchingBoundary(question);

    if (boundary === false) {
        return mapData;
    }

    return modifyMapData(mapData, boundary, question.same);
};

export const hiderifyMatching = async (question: MatchingQuestion) => {
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
            question as HomeGameMatchingQuestions,
        );
        const hiderNearest = await nearestToQuestion({
            lat: $hiderMode.latitude,
            lng: $hiderMode.longitude,
            same: true,
            type: (question as HomeGameMatchingQuestions).type,
            drag: false,
            color: "black",
            collapsed: false,
        });

        question.same =
            questionNearest.properties.name === hiderNearest.properties.name;

        return question;
    }

    if (
        question.type === "same-first-letter-station" ||
        question.type === "same-length-station" ||
        question.type === "same-train-line"
    ) {
        const hiderPoint = turf.point([
            $hiderMode.longitude,
            $hiderMode.latitude,
        ]);
        const seekerPoint = turf.point([question.lng, question.lat]);

        // The same stations as the hiding zones (in Small: U-Bahn only)
        const [stationFilter, ...alternatives] =
            displayHidingZonesOptions.get().length > 0
                ? displayHidingZonesOptions.get()
                : ["[railway=station]"];
        const places = osmtogeojson(
            await findPlacesInZone(
                stationFilter,
                "Finding train stations. This may take a while. Do not press any buttons while this is processing. Don't worry, it will be cached.",
                "nwr",
                "center",
                alternatives,
            ),
        ) as FeatureCollection<Point>;

        const nearestHiderTrainStation = turf.nearestPoint(hiderPoint, places);
        const nearestSeekerTrainStation = turf.nearestPoint(
            seekerPoint,
            places,
        );

        if (question.type === "same-train-line") {
            const nodes = await trainLineNodeFinder(
                nearestSeekerTrainStation.properties.id,
                question.lineKey,
                true,
            );

            const hiderId = parseInt(
                nearestHiderTrainStation.properties.id.split("/")[1],
            );

            if (nodes.includes(hiderId)) {
                question.same = true;
            } else {
                question.same = false;
            }
        }

        const hiderStationName = extractStationName(nearestHiderTrainStation);
        const seekerStationName = extractStationName(nearestSeekerTrainStation);

        if (!hiderStationName || !seekerStationName) {
            return question;
        }

        if (question.type === "same-first-letter-station") {
            if (
                hiderStationName[0].toUpperCase() ===
                seekerStationName[0].toUpperCase()
            ) {
                question.same = true;
            } else {
                question.same = false;
            }
        } else if (question.type === "same-length-station") {
            if (hiderStationName.length === seekerStationName.length) {
                question.lengthComparison = "same";
            } else if (hiderStationName.length < seekerStationName.length) {
                question.lengthComparison = "shorter";
            } else {
                question.lengthComparison = "longer";
            }
        }

        return question;
    }

    if (question.type === "street") {
        const [seekerStreet, hiderStreet] = await Promise.all([
            findNearestStreet(question.lat, question.lng),
            findNearestStreet($hiderMode.latitude, $hiderMode.longitude),
        ]);
        if (seekerStreet && hiderStreet) {
            question.same = seekerStreet.name
                ? seekerStreet.name === hiderStreet.name
                : seekerStreet.id === hiderStreet.id;
        }
        return question;
    }

    const $mapGeoJSON = mapGeoJSON.get();
    if ($mapGeoJSON === null) return question;

    let feature = null;

    try {
        feature = holedMask((await adjustPerMatching(question, $mapGeoJSON))!);
    } catch {
        try {
            feature = await adjustPerMatching(question, {
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
        question.same = !question.same;
    }

    return question;
};

export const matchingPlanningPolygon = async (question: MatchingQuestion) => {
    try {
        const boundary = await determineMatchingBoundary(question);

        if (boundary === false) {
            return false;
        }

        return turf.polygonToLine(boundary);
    } catch {
        return false;
    }
};
