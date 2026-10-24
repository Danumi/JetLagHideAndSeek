import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import type { Feature, FeatureCollection } from "geojson";
import * as L from "leaflet";
import _ from "lodash";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import {
    allTrainStations,
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
    questionFinishedMapData,
    questions,
    selectedZoneId,
    trainStations,
    useCustomStations as useCustomStationsAtom,
} from "@/lib/context";
import { placePickedPoint } from "@/lib/gps";
import { t } from "@/lib/i18n";
import { questionApplies } from "@/maps/answers";
import {
    BLANK_GEOJSON,
    findPlacesSpecificInZone,
    findTentacleLocations,
    nearestToQuestion,
    OverpassError,
    QuestionSpecificLocation,
    type StationCircle,
} from "@/maps/api";
import {
    arcDistance,
    extractStationName,
    geoSpatialVoronoi,
    holedMask,
    safeUnion,
} from "@/maps/geo-utils";
import {
    previewForMap,
    previewOnMap,
    previewZonesRuledOut,
    previewZonesShown,
    withPreview,
} from "@/maps/preview";
import { findHidingZoneStations } from "@/maps/stations";
import { steadyRenderer } from "@/maps/steadyRenderer";
import { findSubwayLines, stationsOnSeekersLine } from "@/maps/subwayLines";
import {
    clearOfZone,
    hiderChosenZone,
    hiderOnlyOwnZone,
    hiderOwnZone,
    outsideZones,
    stationId,
    zoneCircle,
    zonesLeft,
    zonesNotRuledOut,
} from "@/maps/zones";

import { ELIMINATED_STYLE, PREVIEW_CUT_STYLE } from "./Map";

/** Hiding zones are computed once settings stop changing for this long. */
const ZONES_DELAY_MS = 400;

/**
 * The grey outside the zones takes a moment with many zones: it follows
 * once the zones are drawn (and a swipe in the zone list is done).
 */
const OUTSIDE_ZONES_DELAY_MS = 150;

/**
 * The zones left: a thin edge only, so the map stays readable and overlaps
 * don't get darker. Outside them the map is grey (OUTSIDE_ZONES_STYLE).
 */
const ZONE_STYLE: L.PathOptions = {
    color: "#15803d",
    weight: 1.5,
    fill: false,
};

/** Outside every zone left: grey like the area the answers rule out. */
const OUTSIDE_ZONES_STYLE: L.PathOptions = {
    ...ELIMINATED_STYLE,
    stroke: false,
};

/** A zone tapped on the map or in the zone list. */
const SELECTED_STYLE: L.PathOptions = {
    color: "#15803d",
    weight: 3,
    fillColor: "#22c55e",
    fillOpacity: 0.15,
};

/** The zone the hider chose. */
const HIDER_ZONE_STYLE: L.PathOptions = {
    color: "#7c3aed",
    weight: 4,
    fill: false,
};

/** The only zone left: its edge, inside it what the answers ruled out. */
const ONLY_ZONE_STYLE: L.PathOptions = {
    ...ZONE_STYLE,
    weight: 2,
};

/**
 * Works out which hiding zones are left and draws them on the map. With only
 * one zone left, the map shows in detail where in it the hider can be. Shows
 * nothing itself: the list is the ZoneSheet, the count is at the top of the
 * map, a tap on the map picks a zone (Map.tsx).
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
    const includeDefaultStations = useStore(includeDefaultStationsAtom);
    const $customStations = useStore(customStationsAtom);
    const $allTrainStations = useStore(allTrainStations);
    const $selectedZoneId = useStore(selectedZoneId);
    const $hiderChosenZone = useStore(hiderChosenZone);
    const $hiderOwnZone = useStore(hiderOwnZone);
    const $hiderOnlyOwnZone = useStore(hiderOnlyOwnZone);
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

    // The grey outside the zones left, kept until the next one is ready
    const outsideLayerRef = useRef<L.GeoJSON | null>(null);
    // Keeps it drawn while the map is dragged
    const outsideRendererRef = useRef<L.Renderer | null>(null);
    const showOutside = (outside: Feature | null) => {
        outsideLayerRef.current?.remove();
        outsideLayerRef.current = null;
        if (!map || !outside) return;

        // Below the zones' edges and the questions
        const pane =
            map.getPane("outsideZones") ?? map.createPane("outsideZones");
        pane.style.zIndex = "350";
        pane.style.pointerEvents = "none";
        outsideRendererRef.current ??= steadyRenderer("outsideZones");
        outsideLayerRef.current = L.geoJSON(outside, {
            style: OUTSIDE_ZONES_STYLE,
            interactive: false,
            pane: "outsideZones",
            // Passed on to the shapes, like the style
            renderer: outsideRendererRef.current,
        } as L.GeoJSONOptions).addTo(map);
    };

    const showGeoJSON = (
        geoJSONData: any,
        additionalOptions: L.GeoJSONOptions = {},
    ) => {
        if (!map) return;

        removeHidingZones();

        const geoJsonLayer = L.geoJSON(geoJSONData, {
            style: ZONE_STYLE,
            // Taps go to the map, which picks the zone (also where zones
            // overlap or are merged)
            interactive: false,
            pointToLayer(geoJsonPoint, latlng) {
                const marker = L.marker(latlng, {
                    icon: L.divIcon({
                        html: `<div class="text-black bg-opacity-0"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 448 512" width="1em" height="1em" xmlns="http://www.w3.org/2000/svg"><path d="M96 0C43 0 0 43 0 96L0 352c0 48 35.2 87.7 81.1 94.9l-46 46C28.1 499.9 33.1 512 43 512l39.7 0c8.5 0 16.6-3.4 22.6-9.4L160 448l128 0 54.6 54.6c6 6 14.1 9.4 22.6 9.4l39.7 0c10 0 15-12.1 7.9-19.1l-46-46c46-7.1 81.1-46.9 81.1-94.9l0-256c0-53-43-96-96-96L96 0zM64 96c0-17.7 14.3-32 32-32l256 0c17.7 0 32 14.3 32 32l0 96c0 17.7-14.3 32-32 32L96 224c-17.7 0-32-14.3-32-32l0-96zM224 288a48 48 0 1 1 0 96 48 48 0 1 1 0-96z"></path></svg></div>`,
                        className: "",
                    }),
                });

                marker.bindPopup(
                    `<b>${extractStationName(geoJsonPoint) || t("zones.noName")}</b>`,
                );
                // Picking a point: a tap on a station picks the station
                marker.on("click", () => {
                    if (placePickedPoint(latlng)) marker.closePopup();
                });

                return marker;
            },
            ...additionalOptions,
        });

        // @ts-expect-error This is intentionally added as a check
        geoJsonLayer.hidingZones = true;

        geoJsonLayer.addTo(map);
    };

    const $previewZonesRuledOut = useStore(previewZonesRuledOut);

    // "Just look": the zones the answer looked at rules out by their
    // station, red like the area it rules out
    useEffect(() => {
        if (!map || !$displayHidingZones) return;
        const ruledOut = $previewZonesRuledOut.filter(
            (circle) => !$disabledStations.includes(stationId(circle)),
        );
        if (ruledOut.length === 0) return;
        const layer = L.geoJSON(turf.featureCollection(ruledOut), {
            style: PREVIEW_CUT_STYLE,
            interactive: false,
        }).addTo(map);
        return () => {
            layer.remove();
        };
    }, [map, $previewZonesRuledOut, $disabledStations, $displayHidingZones]);

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
                toast.error(t("question.noStationTypes"));
                return;
            }

            allTrainStations.set(places);

            // Distances to McDonald's & co. below are measured in miles
            const hidingRadiusMiles = turf.convertLength(
                $hidingRadius,
                $hidingRadiusUnits,
                "miles",
            );

            let circles = zonesNotRuledOut(
                places.map((place) =>
                    turf.circle(turf.getCoord(place), $hidingRadius, {
                        steps: 32,
                        units: $hidingRadiusUnits,
                        properties: place,
                    }),
                ),
                $questionFinishedMapData,
            );

            // "Just look": the question looked at counts as answered too
            const preview = previewForMap();
            const shownPreview = previewOnMap($questionFinishedMapData);
            let beforePreview: StationCircle[] | null = null;
            for (const question of withPreview(questions.get(), preview)) {
                if (question === preview?.question) beforePreview = circles;
                if (!questionApplies(question, false)) {
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
                        const lines = await findSubwayLines(places).catch(
                            () => null,
                        );
                        // Lines didn't load; the player was offered a retry
                        if (lines === null) continue;

                        if (lines.length === 0) {
                            toast.warning(t("question.lineNoData"), {
                                toastId: "no-subway-lines",
                            });
                            continue;
                        }
                        const onLine = stationsOnSeekersLine(
                            lines,
                            places,
                            question.data,
                            question.data.same,
                        );
                        circles = circles.filter((circle) =>
                            question.data.same
                                ? onLine.has(stationId(circle))
                                : !onLine.has(stationId(circle)),
                        );
                    }

                    const stationName = extractStationName(nearestTrainStation);

                    if (!stationName)
                        return toast.error(t("question.stationNoName"));

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
            // The count of zones left is for the preview the map shows
            previewZonesShown.set(
                preview?.key === shownPreview ? shownPreview : "",
            );
            previewZonesRuledOut.set(
                beforePreview?.filter((circle) => !circles.includes(circle)) ??
                    [],
            );
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
                    toast.error(t("question.zonesFailed"), {
                        toastId: "hiding-zone-initialization-error",
                    });
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
        zonesWaited,
    ]);

    const [drawWaited, setDrawWaited] = useState(0);
    // The zone last shown on its own: the map moves to a new one
    const onlyZoneRef = useRef("");

    useEffect(() => {
        if (!map) return;
        if (isLoading.get()) {
            return isLoading.listen((loading) => {
                if (!loading) setDrawWaited((count) => count + 1);
            });
        }

        // The hider sees all zones too, what the seekers still consider;
        // their own zone (the violet outline below) stays clear of the
        // others. With "Hide other zones" only their own zone: no others and
        // no grey around them, the grey left is what the answers rule out.
        if (!$displayHidingZones || $hiderOnlyOwnZone) {
            removeHidingZones();
            showOutside(null);
            onlyZoneRef.current = "";
            return;
        }

        const left = zonesLeft(stations, $disabledStations);
        const hidden = $displayHidingZonesStyle === "no-display";
        const shapes = styleStations(left, $displayHidingZonesStyle);
        const own = $allTrainStations.find(
            (x) => x.properties.id === $hiderOwnZone,
        );
        showGeoJSON(
            own
                ? clearOfZone(
                      shapes,
                      zoneCircle(own, $hidingRadius, $hidingRadiusUnits),
                  )
                : shapes,
        );

        let cancelled = false;
        // One zone left: where in it the hider can still be
        const showZoneDetail = (station: StationCircle) =>
            zoneDetail(
                station,
                $questionFinishedMapData,
                turf.convertLength($hidingRadius, $hidingRadiusUnits, "miles"),
            )
                .then((mapData) => {
                    if (!cancelled) showOnlyZone(station, mapData);
                })
                .catch((error) => {
                    console.log("Error in hiding zone selection:", error);
                    if (cancelled || error instanceof OverpassError) return;
                    toast.error(t("question.zoneDetailFailed"), {
                        toastId: "hiding-zone-selection-error",
                    });
                });

        if (left.length !== 1 || hidden) onlyZoneRef.current = "";
        else moveToOnlyZone(left[0]);

        // The detail replaces the grey outside the zone, so it comes after
        const outsideTimer = setTimeout(() => {
            showOutside(
                hidden ? null : outsideZones(left, $questionFinishedMapData),
            );
            if (left.length === 1 && !hidden) showZoneDetail(left[0]);
        }, OUTSIDE_ZONES_DELAY_MS);

        return () => {
            cancelled = true;
            clearTimeout(outsideTimer);
        };
    }, [
        $disabledStations,
        $displayHidingZones,
        $displayHidingZonesStyle,
        $hiderOnlyOwnZone,
        $hiderOwnZone,
        $hidingRadius,
        $hidingRadiusUnits,
        $questionFinishedMapData,
        stations,
        drawWaited,
    ]);

    /** The map moves to a zone the first time it is the only one left. */
    const moveToOnlyZone = (station: StationCircle) => {
        if (!map) return;
        if (onlyZoneRef.current !== stationId(station)) {
            onlyZoneRef.current = stationId(station);
            const [west, south, east, north] = turf.bbox(station);
            followMyPosition.set(false);
            map.fitBounds(
                [
                    [south, west],
                    [north, east],
                ],
                { padding: [40, 40] },
            );
        }
    };

    /** The only zone left: grey where the answers rule out parts of it. */
    const showOnlyZone = (station: StationCircle, mapData: any) => {
        if (!map) return;

        // Only what the zone adds to the grey area the map already shows
        let ruledOut: Feature | null = null;
        try {
            const all =
                mapData.type === "FeatureCollection"
                    ? safeUnion(mapData)
                    : mapData;
            const shown = $questionFinishedMapData?.features?.[0];
            ruledOut = shown
                ? turf.difference(turf.featureCollection([all, shown]))
                : all;
        } catch (error) {
            console.log(error);
            ruledOut = null;
        }

        removeHidingZones();
        // The detail greys out what is outside the zone itself
        showOutside(null);
        const layers = [
            L.geoJSON(station, { style: ONLY_ZONE_STYLE, interactive: false }),
        ];
        if (ruledOut) {
            layers.push(
                L.geoJSON(ruledOut, {
                    style: ELIMINATED_STYLE,
                    interactive: false,
                }),
            );
        }
        for (const layer of layers) {
            // @ts-expect-error This is intentionally added as a check
            layer.hidingZones = true;
            layer.addTo(map);
        }
    };

    useEffect(() => {
        if (!map) return;

        // Above the zones, below the blue dot and the question markers
        const pane =
            map.getPane("zoneHighlight") ?? map.createPane("zoneHighlight");
        pane.style.zIndex = "405";
        pane.style.pointerEvents = "none";

        const zoneOutline = (id: string, style: L.PathOptions) => {
            const station = $allTrainStations.find(
                (x) => x.properties.id === id,
            );
            if (!station) return null;
            return L.geoJSON(
                zoneCircle(station, $hidingRadius, $hidingRadiusUnits),
                { style, interactive: false, pane: "zoneHighlight" },
            );
        };

        const layers: (L.GeoJSON | null)[] = [];
        if ($displayHidingZones) {
            if ($hiderChosenZone) {
                layers.push(zoneOutline($hiderChosenZone, HIDER_ZONE_STYLE));
            }
            // The hider's own zone stays violet when tapped
            if ($selectedZoneId && $selectedZoneId !== $hiderChosenZone) {
                layers.push(zoneOutline($selectedZoneId, SELECTED_STYLE));
            }
        }
        const shown = layers.filter((x) => x !== null).map((x) => x.addTo(map));
        return () => shown.forEach((layer) => layer.remove());
    }, [
        map,
        $allTrainStations,
        $displayHidingZones,
        $hiderChosenZone,
        $hidingRadius,
        $hidingRadiusUnits,
        $selectedZoneId,
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
            // Before the zones are worked out there's nothing to merge
            if (circles.length === 0) return turf.featureCollection([]);
            return safeUnion(turf.featureCollection(circles));

        case "stations":
            return turf.featureCollection(circles.map((c) => c.properties));

        default:
            return turf.featureCollection(circles);
    }
}

/**
 * Where the hider can't be, for one zone: everything outside it, and inside
 * it what the answers rule out near its station (e.g. "same nearest park").
 */
async function zoneDetail(
    station: any,
    $questionFinishedMapData: any,
    hidingRadiusMiles: number,
) {
    let mapData: any = turf.featureCollection([
        safeUnion(
            turf.featureCollection([
                ...$questionFinishedMapData.features,
                turf.mask(station),
            ]),
        ),
    ]);

    for (const question of withPreview(questions.get())) {
        if (!questionApplies(question, false)) {
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
                    t("loading.zonePlaces"),
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
        toast.warning(t("question.zoneRuledOut"), {
            toastId: "zone-ruled-out",
        });
    }

    return mapData;
}
