import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import type { Feature, FeatureCollection } from "geojson";
import * as L from "leaflet";
import _ from "lodash";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

import {
    allTrainStations,
    animateMapMovements,
    autoZoom,
    customStations as customStationsAtom,
    disabledStations,
    displayHidingZones,
    displayHidingZonesOptions,
    displayHidingZonesStyle,
    followMyPosition,
    hidingRadius,
    hidingRadiusUnits,
    includeDefaultStations as includeDefaultStationsAtom,
    isLoading,
    leafletMapContext,
    mergeDuplicates as mergeDuplicatesAtom,
    planningModeEnabled,
    questionFinishedMapData,
    questions,
    selectedZoneId,
    trainStations,
    useCustomStations as useCustomStationsAtom,
} from "@/lib/context";
import { questionApplies } from "@/maps/answers";
import {
    BLANK_GEOJSON,
    findPlacesSpecificInZone,
    findTentacleLocations,
    nearestToQuestion,
    OverpassError,
    QuestionSpecificLocation,
    type StationCircle,
    trainLineNodeFinder,
} from "@/maps/api";
import {
    arcDistance,
    extractStationName,
    geoSpatialVoronoi,
    holedMask,
    lngLatToText,
    safeUnion,
} from "@/maps/geo-utils";
import { findHidingZoneStations } from "@/maps/stations";

/** Hiding zones are computed once settings stop changing for this long. */
const ZONES_DELAY_MS = 400;

/**
 * Works out which hiding zones are left and draws them on the map, or the
 * one zone picked on the map or in the zone list. Shows nothing itself: the
 * list is the ZoneSheet, the count is at the top of the map.
 */
export const HidingZones = () => {
    const $displayHidingZones = useStore(displayHidingZones);
    const $questionFinishedMapData = useStore(questionFinishedMapData);
    const $displayHidingZonesOptions = useStore(displayHidingZonesOptions);
    const $displayHidingZonesStyle = useStore(displayHidingZonesStyle);
    const $hidingRadius = useStore(hidingRadius);
    const $hidingRadiusUnits = useStore(hidingRadiusUnits);
    const map = useStore(leafletMapContext);
    const stations = useStore(trainStations);
    const $disabledStations = useStore(disabledStations);
    const useCustomStations = useStore(useCustomStationsAtom);
    const mergeDuplicates = useStore(mergeDuplicatesAtom);
    const includeDefaultStations = useStore(includeDefaultStationsAtom);
    const $customStations = useStore(customStationsAtom);
    const hidingZoneModeStationID = useStore(selectedZoneId);
    const setStations = trainStations.set;

    const removeHidingZones = () => {
        if (!map) return;

        map.eachLayer((layer: any) => {
            if (layer.hidingZones) {
                // Hopefully only geoJSON layers
                map.removeLayer(layer);
            }
        });
    };

    const showGeoJSON = (
        geoJSONData: any,
        nonOverlappingStations: boolean = false,
        additionalOptions: L.GeoJSONOptions = {},
    ) => {
        if (!map) return;

        removeHidingZones();

        const geoJsonLayer = L.geoJSON(geoJSONData, {
            style: {
                color: "green",
                fillColor: "green",
                fillOpacity: 0.2,
            },
            onEachFeature: nonOverlappingStations
                ? (feature, layer) => {
                      layer.on("click", async () => {
                          if (!map) return;

                          selectedZoneId.set(feature.properties.properties.id);
                      });
                  }
                : undefined,
            pointToLayer(geoJsonPoint, latlng) {
                const marker = L.marker(latlng, {
                    icon: L.divIcon({
                        html: `<div class="text-black bg-opacity-0"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 448 512" width="1em" height="1em" xmlns="http://www.w3.org/2000/svg"><path d="M96 0C43 0 0 43 0 96L0 352c0 48 35.2 87.7 81.1 94.9l-46 46C28.1 499.9 33.1 512 43 512l39.7 0c8.5 0 16.6-3.4 22.6-9.4L160 448l128 0 54.6 54.6c6 6 14.1 9.4 22.6 9.4l39.7 0c10 0 15-12.1 7.9-19.1l-46-46c46-7.1 81.1-46.9 81.1-94.9l0-256c0-53-43-96-96-96L96 0zM64 96c0-17.7 14.3-32 32-32l256 0c17.7 0 32 14.3 32 32l0 96c0 17.7-14.3 32-32 32L96 224c-17.7 0-32-14.3-32-32l0-96zM224 288a48 48 0 1 1 0 96 48 48 0 1 1 0-96z"></path></svg></div>`,
                        className: "",
                    }),
                });

                marker.bindPopup(
                    `<b>${
                        extractStationName(geoJsonPoint) || "No Name Found"
                    } (${lngLatToText(
                        geoJsonPoint.geometry.coordinates as [number, number],
                    )})</b>`,
                );

                return marker;
            },
            ...additionalOptions,
        });

        // @ts-expect-error This is intentionally added as a check
        geoJsonLayer.hidingZones = true;

        geoJsonLayer.addTo(map);
    };

    // Bumped when a change had to wait for the map, so it isn't lost
    const [zonesWaited, setZonesWaited] = useState(0);

    useEffect(() => {
        if (!map) return;
        if (isLoading.get()) {
            return isLoading.listen((loading) => {
                if (!loading) setZonesWaited((count) => count + 1);
            });
        }

        const initializeHidingZones = async () => {
            const places = await findHidingZoneStations();
            if (places === null) {
                toast.error("At least one place type must be selected");
                return;
            }

            allTrainStations.set(places);

            // Distances to McDonald's & co. below are measured in miles
            const hidingRadiusMiles = turf.convertLength(
                $hidingRadius,
                $hidingRadiusUnits,
                "miles",
            );

            const unionized = safeUnion(
                turf.simplify($questionFinishedMapData, {
                    tolerance: 0.001,
                }),
            );

            let circles = places
                .map((place) => {
                    const radius = $hidingRadius;
                    const center = turf.getCoord(place);
                    const circle = turf.circle(center, radius, {
                        steps: 32,
                        units: $hidingRadiusUnits,
                        properties: place,
                    });

                    return circle;
                })
                .filter((circle) => {
                    return !turf.booleanWithin(circle, unionized);
                });

            for (const question of questions.get()) {
                if (!questionApplies(question, planningModeEnabled.get())) {
                    continue;
                }

                if (
                    question.id === "matching" &&
                    (question.data.type === "same-first-letter-station" ||
                        question.data.type === "same-length-station" ||
                        question.data.type === "same-train-line")
                ) {
                    const location = turf.point([
                        question.data.lng,
                        question.data.lat,
                    ]);

                    // Nearest among all stations: the seekers' own station
                    // is usually already ruled out as a hiding zone.
                    const nearestTrainStation = turf.nearestPoint(
                        location,
                        turf.featureCollection(places) as any,
                    );

                    if (question.data.type === "same-train-line") {
                        // Custom-only lists don't have reliable OSM IDs
                        if (useCustomStations && !includeDefaultStations) {
                            toast.warning(
                                "'Same train line' isn't supported with custom-only station lists; skipping this filter.",
                            );
                        } else {
                            const nid = nearestTrainStation.properties.id as
                                | string
                                | undefined;
                            if (!nid || !nid.includes("/")) {
                                toast.warning(
                                    "Nearest station has no OSM id; skipping 'same train line' filter.",
                                );
                                continue;
                            }

                            const nodes = await trainLineNodeFinder(
                                nid,
                                question.data.lineKey,
                                question.data.same,
                            ).catch(() => null);

                            // Lines didn't load; the player was offered a retry
                            if (nodes === null) continue;

                            if (nodes.length === 0) {
                                toast.warning(
                                    `No train line found for ${extractStationName(
                                        nearestTrainStation,
                                    )}`,
                                );
                                continue;
                            } else {
                                circles = circles.filter((circle) => {
                                    const idProp =
                                        circle.properties.properties.id;
                                    if (!idProp || !idProp.includes("/"))
                                        return false;
                                    const id = parseInt(idProp.split("/")[1]);

                                    return question.data.same
                                        ? nodes.includes(id)
                                        : !nodes.includes(id);
                                });
                            }
                        }
                    }

                    const stationName = extractStationName(nearestTrainStation);

                    if (!stationName)
                        return toast.error("Seekers' station has no name");

                    if (question.data.type === "same-first-letter-station") {
                        const letter = stationName[0].toUpperCase();

                        circles = circles.filter((circle) => {
                            const name = extractStationName(circle.properties);
                            if (!name) return false;

                            return question.data.same
                                ? name[0].toUpperCase() === letter
                                : name[0].toUpperCase() !== letter;
                        });
                    } else if (question.data.type === "same-length-station") {
                        const seekerLength = stationName.length;
                        const comparison = question.data.lengthComparison;

                        circles = circles.filter((circle) => {
                            const name = extractStationName(circle.properties);
                            if (!name) return false;

                            if (comparison === "same") {
                                return name.length === seekerLength;
                            } else if (comparison === "shorter") {
                                return name.length < seekerLength;
                            } else if (comparison === "longer") {
                                return name.length > seekerLength;
                            } else if (comparison === "different") {
                                return name.length !== seekerLength;
                            }
                            return false;
                        });
                    }
                }
                if (
                    question.id === "measuring" &&
                    (question.data.type === "mcdonalds" ||
                        question.data.type === "seven11")
                ) {
                    const points = await findPlacesSpecificInZone(
                        question.data.type === "mcdonalds"
                            ? QuestionSpecificLocation.McDonalds
                            : QuestionSpecificLocation.Seven11,
                    ).catch(() => null);
                    if (points === null) continue;

                    const nearestPoint = turf.nearestPoint(
                        turf.point([question.data.lng, question.data.lat]),
                        points as any,
                    );

                    const distance = await arcDistance(
                        turf.point([question.data.lng, question.data.lat]),
                        nearestPoint as any,
                        "miles",
                    );

                    const eligibleCircles = await Promise.all(
                        circles.map(async (circle) => {
                            const point = turf.point(
                                turf.getCoord(circle.properties),
                            );
                            const nearest = turf.nearestPoint(
                                point,
                                points as any,
                            );
                            const stationDistance = await arcDistance(
                                point,
                                nearest as any,
                                "miles",
                            );

                            return question.data.hiderCloser
                                ? stationDistance < distance + hidingRadiusMiles
                                : stationDistance >
                                      distance - hidingRadiusMiles;
                        }),
                    );
                    circles = circles.filter(
                        (_, index) => eligibleCircles[index],
                    );
                }
            }

            setStations(circles);
        };

        if (!$displayHidingZones || !$questionFinishedMapData) return;

        // Wait until typing (e.g. the radius) has stopped
        const timer = setTimeout(() => {
            if (isLoading.get()) {
                const unbind = isLoading.listen((loading) => {
                    if (loading) return;
                    unbind();
                    setZonesWaited((count) => count + 1);
                });
                return;
            }

            isLoading.set(true);
            initializeHidingZones()
                .catch((error) => {
                    console.log("Error in hiding zone initialization:", error);
                    if (error instanceof OverpassError) return; // Retry offered
                    toast.error(
                        "An error occurred during hiding zone initialization",
                        { toastId: "hiding-zone-initialization-error" },
                    );
                })
                .finally(() => isLoading.set(false));
        }, ZONES_DELAY_MS);

        return () => clearTimeout(timer);
    }, [
        $questionFinishedMapData,
        $displayHidingZones,
        $displayHidingZonesOptions,
        $hidingRadius,
        $hidingRadiusUnits,
        useCustomStations,
        includeDefaultStations,
        $customStations,
        mergeDuplicates,
        zonesWaited,
    ]);

    const [drawWaited, setDrawWaited] = useState(0);

    useEffect(() => {
        if (!map) return;
        if (isLoading.get()) {
            return isLoading.listen((loading) => {
                if (!loading) setDrawWaited((count) => count + 1);
            });
        }

        if ($displayHidingZones && hidingZoneModeStationID) {
            const hiderStation = _.find(
                stations,
                (c) => c.properties.properties.id === hidingZoneModeStationID,
            );

            if (hiderStation !== undefined) {
                selectionProcess(
                    hiderStation,
                    map,
                    showGeoJSON,
                    $questionFinishedMapData,
                    turf.convertLength(
                        $hidingRadius,
                        $hidingRadiusUnits,
                        "miles",
                    ),
                ).catch((error) => {
                    console.log("Error in hiding zone selection:", error);
                    toast.error(
                        "An error occurred during hiding zone selection",
                        { toastId: "hiding-zone-selection-error" },
                    );
                });
            } else {
                // The zone is gone, e.g. after a new game: back to all zones
                selectedZoneId.set("");
            }
        } else if ($displayHidingZones) {
            const activeStations = stations.filter(
                (x) => !$disabledStations.includes(x.properties.properties.id),
            );
            showGeoJSON(
                styleStations(activeStations, $displayHidingZonesStyle),
                $displayHidingZonesStyle === "zones",
            );
        } else {
            removeHidingZones();
        }
    }, [
        $disabledStations,
        $displayHidingZones,
        $displayHidingZonesStyle,
        $hidingRadius,
        $hidingRadiusUnits,
        $questionFinishedMapData,
        hidingZoneModeStationID,
        stations,
        drawWaited,
    ]);

    return null;
};

function styleStations(
    circles: StationCircle[],
    style: string,
): FeatureCollection | Feature {
    switch (style) {
        case "no-display":
            return { type: "FeatureCollection", features: [] };

        case "no-overlap":
            return safeUnion(turf.featureCollection(circles));

        case "stations":
            return turf.featureCollection(circles.map((c) => c.properties));

        default:
            return turf.featureCollection(circles);
    }
}

async function selectionProcess(
    station: any,
    map: L.Map,
    showGeoJSON: (geoJSONData: any) => void,
    $questionFinishedMapData: any,
    hidingRadiusMiles: number,
) {
    const bbox = turf.bbox(station);

    const bounds: [[number, number], [number, number]] = [
        [bbox[1], bbox[0]],
        [bbox[3], bbox[2]],
    ];

    let mapData: any = turf.featureCollection([
        safeUnion(
            turf.featureCollection([
                ...$questionFinishedMapData.features,
                turf.mask(station),
            ]),
        ),
    ]);

    for (const question of questions.get()) {
        if (!questionApplies(question, planningModeEnabled.get())) {
            continue;
        }

        if (
            (question.id === "measuring" || question.id === "matching") &&
            (question.data.type === "aquarium" ||
                question.data.type === "zoo" ||
                question.data.type === "theme_park" ||
                question.data.type === "peak" ||
                question.data.type === "museum" ||
                question.data.type === "hospital" ||
                question.data.type === "cinema" ||
                question.data.type === "library" ||
                question.data.type === "golf_course" ||
                question.data.type === "consulate" ||
                question.data.type === "park")
        ) {
            const nearestQuestion = await nearestToQuestion(question.data);

            let radius = 30;

            let instances: any = { features: [] };

            const nearestPoints = [];

            while (instances.features.length === 0) {
                instances = await findTentacleLocations(
                    {
                        lat: station.properties.geometry.coordinates[1],
                        lng: station.properties.geometry.coordinates[0],
                        radius: radius,
                        unit: "miles",
                        locationType: question.data.type,
                    },
                    "Finding matching locations to hiding zone...",
                );

                const distances: any[] = await Promise.all(
                    instances.features.map(async (x: any) => ({
                        distance: await arcDistance(
                            turf.point(turf.getCoord(x)),
                            station.properties,
                            "miles",
                        ),
                        point: x,
                    })),
                );

                if (distances.length === 0) {
                    radius += 30;
                    continue;
                }

                const minimumPoint = _.minBy(distances, "distance")!;

                if (minimumPoint.distance + hidingRadiusMiles * 2 > radius) {
                    radius = minimumPoint.distance + hidingRadiusMiles * 2;
                    continue;
                }

                nearestPoints.push(
                    ...distances
                        .filter(
                            (x) =>
                                x.distance <
                                    minimumPoint.distance +
                                        hidingRadiusMiles * 2 &&
                                x.point.properties.name, // If it doesn't have a name, it's not a valid location
                        )
                        .map((x) => x.point),
                );
            }

            if (question.id === "matching") {
                const voronoi = geoSpatialVoronoi(
                    turf.featureCollection(nearestPoints),
                );

                const correctPolygon = voronoi.features.find((feature: any) => {
                    return (
                        feature.properties.site.properties.name ===
                        nearestQuestion.properties.name
                    );
                });

                if (!correctPolygon) {
                    if (question.data.same) {
                        mapData = BLANK_GEOJSON;
                    }

                    continue;
                }

                if (question.data.same) {
                    mapData = safeUnion(
                        turf.featureCollection([
                            ...mapData.features,
                            turf.mask(correctPolygon),
                        ]),
                    );
                } else {
                    mapData = safeUnion(
                        turf.featureCollection([
                            ...mapData.features,
                            correctPolygon,
                        ]),
                    );
                }
            } else {
                const circles = nearestPoints.map((x) =>
                    turf.circle(
                        turf.getCoord(x),
                        nearestQuestion.properties.distanceToPoint,
                    ),
                );

                if (question.data.hiderCloser) {
                    mapData = safeUnion(
                        turf.featureCollection([
                            ...mapData.features,
                            holedMask(turf.featureCollection(circles)),
                        ]),
                    );
                } else {
                    mapData = safeUnion(
                        turf.featureCollection([
                            ...mapData.features,
                            ...circles,
                        ]),
                    );
                }
            }
        }
        if (
            question.id === "measuring" &&
            (question.data.type === "mcdonalds" ||
                question.data.type === "seven11")
        ) {
            const points = await findPlacesSpecificInZone(
                question.data.type === "mcdonalds"
                    ? QuestionSpecificLocation.McDonalds
                    : QuestionSpecificLocation.Seven11,
            );

            const seeker = turf.point([question.data.lng, question.data.lat]);
            const nearest = turf.nearestPoint(seeker, points as any);

            const distance = await arcDistance(seeker, nearest, "miles");

            const nearStation = await Promise.all(
                points.features.map(
                    async (x) =>
                        (await arcDistance(
                            x as any,
                            station.properties.geometry,
                            "miles",
                        )) <
                        distance + hidingRadiusMiles,
                ),
            );
            const filtered = points.features.filter(
                (_, index) => nearStation[index],
            );

            const circles = filtered.map((x) =>
                turf.circle(x as any, distance, {
                    units: "miles",
                }),
            );

            if (question.data.hiderCloser) {
                mapData = safeUnion(
                    turf.featureCollection([
                        ...mapData.features,
                        holedMask(turf.featureCollection(circles)),
                    ]),
                );
            } else {
                mapData = safeUnion(
                    turf.featureCollection([...mapData.features, ...circles]),
                );
            }
        }

        if (mapData.type !== "FeatureCollection") {
            mapData = {
                type: "FeatureCollection",
                features: [mapData],
            };
        }
    }

    if (_.isEqual(mapData, BLANK_GEOJSON)) {
        toast.warning(
            "The hider cannot be in this hiding zone. This wasn't eliminated on the sidebar as its absence was caused by multiple criteria.",
        );
    }

    showGeoJSON(mapData);

    if (autoZoom.get()) {
        // Show the zone, not the blue dot
        followMyPosition.set(false);
        if (animateMapMovements.get()) {
            map?.flyToBounds(bounds);
        } else {
            map?.fitBounds(bounds);
        }
    }

    const element: HTMLDivElement | null = document.querySelector(
        `[data-station-id="${station.properties.properties.id}"]`,
    );

    if (element) {
        element.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
        element.classList.add("selected-card-background-temporary");

        setTimeout(() => {
            element.classList.remove("selected-card-background-temporary");
        }, 5000);
    }
}
