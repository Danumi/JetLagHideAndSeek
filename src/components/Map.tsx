import "leaflet/dist/leaflet.css";
import "leaflet-contextmenu/dist/leaflet.contextmenu.css";
import "leaflet-contextmenu";

import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import * as L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, ScaleControl, TileLayer } from "react-leaflet";
import { toast } from "react-toastify";

import {
    additionalMapGeoLocations,
    addQuestion,
    baseTileLayer,
    drawingQuestionKey,
    followMyPosition,
    isLoading,
    leafletMapContext,
    mapGeoJSON,
    mapGeoLocation,
    myPosition,
    pickingLocation,
    polyGeoJSON,
    questionFinishedMapData,
    questions,
    showAllQuestionTypes,
} from "@/lib/context";
import { MY_POSITION_ZOOM, placePickedPoint, watchMyPosition } from "@/lib/gps";
import { language, t } from "@/lib/i18n";
import { retryTrigger } from "@/lib/loading";
import { cn } from "@/lib/utils";
import { applyQuestionsToMapGeoData, holedMask } from "@/maps";
import { determineMapBoundaries } from "@/maps/api";
import { tapZoneAt } from "@/maps/zones";

import { DraggableMarkers } from "./DraggableMarkers";
import { MapLayersOverlay, tapLineAt } from "./MapLayers";
import { NearestMarks } from "./NearestMarks";
import { PolygonDraw } from "./PolygonDraw";

/** The map is computed once questions stop changing for this long. */
const MAP_REFRESH_DELAY_MS = 400;

/** Where the hider can't be any more. */
export const ELIMINATED_STYLE: L.PathOptions = {
    color: "#334155",
    weight: 2,
    fillColor: "#475569",
    fillOpacity: 0.3,
};

const getTileLayer = (tileLayer: string) => {
    switch (tileLayer) {
        case "light":
            return (
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_2hdi_1_0b36dd202687c7d7c2b90861"
                    subdomains="abcd"
                    maxZoom={20} // This technically should be 6, but once the ratelimiting starts this can take over
                    minZoom={2}
                    noWrap
                />
            );

        case "dark":
            return (
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=cb1_2hdi_1_0b36dd202687c7d7c2b90861"
                    subdomains="abcd"
                    maxZoom={20} // This technically should be 6, but once the ratelimiting starts this can take over
                    minZoom={2}
                    noWrap
                />
            );

        case "osmcarto":
            return (
                <TileLayer
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={19}
                    minZoom={2}
                    noWrap
                />
            );
    }

    return (
        <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=cb1_2hdi_1_0b36dd202687c7d7c2b90861"
            subdomains="abcd"
            maxZoom={20} // This technically should be 6, but once the ratelimiting starts this can take over
            minZoom={2}
            noWrap
        />
    );
};

/**
 * Zooms to a new radar outline, as far as it is in the game area (a big
 * radar encloses all of it). The map keeps following you if you are in view.
 */
/** The loading screen (index.astro) fades out once the map is there. */
const hideSplash = () => {
    const splash = document.getElementById("splash");
    if (!splash) return;
    splash.style.opacity = "0";
    setTimeout(() => splash.remove(), 400);
};

const showRadarOutline = (map: L.Map, outline: L.LatLngBounds) => {
    let bounds = outline;
    const area = mapGeoJSON.get();
    if (area) {
        const [west, south, east, north] = turf.bbox(area);
        const inArea = {
            south: Math.max(south, outline.getSouth()),
            west: Math.max(west, outline.getWest()),
            north: Math.min(north, outline.getNorth()),
            east: Math.min(east, outline.getEast()),
        };
        if (inArea.south < inArea.north && inArea.west < inArea.east) {
            bounds = L.latLngBounds(
                [inArea.south, inArea.west],
                [inArea.north, inArea.east],
            );
        }
    }

    const position = myPosition.get();
    if (position && !bounds.contains([position.lat, position.lng])) {
        followMyPosition.set(false);
    }
    map.fitBounds(bounds, { padding: [24, 24] });
};

/** The long-press menu: questions of every type, for experts. */
const longPressMenu = () => [
    {
        text: t("add.radar"),
        callback: (e: any) =>
            addQuestion({
                id: "radius",
                data: {
                    lat: e.latlng.lat,
                    lng: e.latlng.lng,
                },
            }),
    },
    {
        text: t("add.thermometer"),
        callback: (e: any) => {
            const destination = turf.destination(
                [e.latlng.lng, e.latlng.lat],
                1,
                90,
                {
                    units: "kilometers",
                },
            );

            addQuestion({
                id: "thermometer",
                data: {
                    latA: e.latlng.lat,
                    lngA: e.latlng.lng,
                    latB: destination.geometry.coordinates[1],
                    lngB: destination.geometry.coordinates[0],
                },
            });
        },
    },
    {
        text: t("add.tentacles"),
        callback: (e: any) => {
            addQuestion({
                id: "tentacles",
                data: {
                    lat: e.latlng.lat,
                    lng: e.latlng.lng,
                },
            });
        },
    },
    {
        text: t("add.matching"),
        callback: (e: any) => {
            addQuestion({
                id: "matching",
                data: {
                    lat: e.latlng.lat,
                    lng: e.latlng.lng,
                },
            });
        },
    },
    {
        text: t("add.measuring"),
        callback: (e: any) => {
            addQuestion({
                id: "measuring",
                data: {
                    lat: e.latlng.lat,
                    lng: e.latlng.lng,
                },
            });
        },
    },
    {
        text: t("add.excludeCountry"),
        callback: (e: any) => {
            addQuestion({
                id: "matching",
                data: {
                    lat: e.latlng.lat,
                    lng: e.latlng.lng,
                    same: false,
                    cat: {
                        adminLevel: 2,
                    },
                    type: "zone",
                },
            });
        },
    },
];

export const Map = ({ className }: { className?: string }) => {
    useStore(additionalMapGeoLocations);
    const $mapGeoLocation = useStore(mapGeoLocation);
    const $questions = useStore(questions);
    const $baseTileLayer = useStore(baseTileLayer);
    const map = useStore(leafletMapContext);

    // Time of the last touch, click or scroll on the map
    const lastMapInteractionRef = useMemo(() => ({ current: 0 }), []);
    // A refresh asked for while the map is busy runs once it is done, so an
    // answer given during loading isn't lost (the value is its focus flag)
    const refreshAgainRef = useMemo(
        () => ({ current: null as boolean | null }),
        [],
    );
    const latestRefreshRef = useMemo(
        () => ({ current: null as ((focus: boolean) => void) | null }),
        [],
    );
    // Where each radar outline on the map is (null before the first map):
    // the map zooms to a new or changed one, which may be bigger than the
    // screen while the map follows you
    const radarOutlinesRef = useMemo(
        () => ({ current: null as Record<number, string> | null }),
        [],
    );

    const refreshQuestions = async (focus: boolean = false) => {
        if (!map) return;

        if (isLoading.get()) {
            refreshAgainRef.current =
                (refreshAgainRef.current ?? false) || focus;
            return;
        }

        isLoading.set(true);
        const startedAt = Date.now();

        let mapGeoData = mapGeoJSON.get();

        if (!mapGeoData) {
            const polyGeoData = polyGeoJSON.get();
            if (polyGeoData) {
                mapGeoData = polyGeoData;
                mapGeoJSON.set(polyGeoData);
            } else {
                // No toast.promise here: without a "pending" message it
                // dismisses every other message once the area has loaded
                await determineMapBoundaries()
                    .then((x) => {
                        mapGeoJSON.set(x);
                        mapGeoData = x;
                    })
                    .catch((error) => console.log(error));
            }
        }

        if (!mapGeoData) {
            // The game area didn't load; "Retry" tries again
            isLoading.set(false);
            return;
        }

        map.eachLayer((layer: any) => {
            if (layer.questionKey || layer.questionKey === 0) {
                map.removeLayer(layer);
            }
        });

        const knownRadarOutlines = radarOutlinesRef.current;
        const radarOutlines: Record<number, string> = {};
        let newRadarOutline: L.LatLngBounds | null = null;

        try {
            mapGeoData = await applyQuestionsToMapGeoData(
                $questions,
                mapGeoData,
                false, // no planning mode
                (geoJSONObj, question) => {
                    // Questions waiting for an answer: dashed orange outline
                    const geoJSONPlane = L.geoJSON(
                        geoJSONObj,
                        question.data.status === "pending"
                            ? {
                                  style: {
                                      color: "#f97316",
                                      weight: 3,
                                      dashArray: "8 6",
                                  },
                              }
                            : undefined,
                    );
                    // @ts-expect-error This is a check such that only this type of layer is removed
                    geoJSONPlane.questionKey = question.key;
                    geoJSONPlane.addTo(map);

                    if (question.id === "radius") {
                        const { lat, lng, radius, unit } = question.data;
                        const where = JSON.stringify([lat, lng, radius, unit]);
                        radarOutlines[question.key] = where;
                        if (
                            knownRadarOutlines &&
                            knownRadarOutlines[question.key] !== where
                        ) {
                            newRadarOutline = geoJSONPlane.getBounds();
                        }
                    }
                },
            );
            radarOutlinesRef.current = radarOutlines;

            mapGeoData = {
                type: "FeatureCollection",
                features: [holedMask(mapGeoData!)!],
            };

            map.eachLayer((layer: any) => {
                if (layer.eliminationGeoJSON) {
                    // Hopefully only geoJSON layers
                    map.removeLayer(layer);
                }
            });

            const g = L.geoJSON(mapGeoData, {
                style: ELIMINATED_STYLE,
                interactive: false,
            });
            // @ts-expect-error This is a check such that only this type of layer is removed
            g.eliminationGeoJSON = true;
            g.addTo(map);

            questionFinishedMapData.set(mapGeoData);

            // Don't pull the map away from where the user moved it while
            // loading, or from the blue dot while the map follows it
            const movedWhileLoading =
                lastMapInteractionRef.current >= startedAt;
            const following =
                followMyPosition.get() && myPosition.get() !== null;

            if (newRadarOutline && !movedWhileLoading) {
                showRadarOutline(map, newRadarOutline);
            } else if (focus && !movedWhileLoading && !following) {
                const bbox = turf.bbox(holedMask(mapGeoData) as any);
                map.fitBounds([
                    [bbox[1], bbox[0]],
                    [bbox[3], bbox[2]],
                ]);
            }
        } catch (error) {
            console.log(error);

            isLoading.set(false);
            if (document.querySelectorAll(".Toastify__toast").length === 0) {
                return toast.error(t("question.mapFailed"));
            }
        } finally {
            isLoading.set(false);
        }
    };

    const displayMap = useMemo(
        () => (
            <MapContainer
                center={$mapGeoLocation.geometry.coordinates}
                zoom={5}
                zoomControl={false}
                // The credits for the map data are in Settings → About
                attributionControl={false}
                className={cn("w-[500px] h-[500px]", className)}
                ref={leafletMapContext.set}
                // @ts-expect-error Typing doesn't update from react-contextmenu
                contextmenu={true}
                contextmenuWidth={140}
                contextmenuItems={longPressMenu()}
            >
                {getTileLayer($baseTileLayer)}
                <DraggableMarkers />
                <MapLayersOverlay />
                <NearestMarks />
                <PolygonDraw />
                <ScaleControl position="topleft" imperial={false} />
            </MapContainer>
        ),
        [map, $baseTileLayer],
    );

    latestRefreshRef.current = refreshQuestions;

    useEffect(() => {
        if (map) hideSplash();
    }, [map]);

    useEffect(
        () =>
            isLoading.listen((loading) => {
                if (loading || refreshAgainRef.current === null) return;
                const focus = refreshAgainRef.current;
                refreshAgainRef.current = null;
                setTimeout(() => latestRefreshRef.current?.(focus), 0);
            }),
        [],
    );

    useEffect(() => {
        if (!map) return;

        // Wait until typing or dragging has stopped
        const timer = setTimeout(
            () => refreshQuestions(true),
            MAP_REFRESH_DELAY_MS,
        );
        return () => clearTimeout(timer);
    }, [$questions, map]);

    useEffect(
        () =>
            // Questions whose data failed to load are computed again
            retryTrigger.listen(() => latestRefreshRef.current?.(false)),
        [],
    );

    useEffect(() => {
        if (!map) return;

        // "Pick on map": the next tap on the map sets the point. Otherwise a
        // tap on a line shown highlights it; elsewhere it picks the hiding
        // zone there, or closes the one shown
        const onClick = (event: L.LeafletMouseEvent) => {
            if (placePickedPoint(event.latlng)) return;
            // Drawing a custom question: taps add corners
            if (drawingQuestionKey.get() !== -1) return;
            if (tapLineAt(map, event.latlng)) return;
            tapZoneAt(event.latlng);
        };
        map.on("click", onClick);
        const unbindPicking = pickingLocation.subscribe((target) =>
            map.getContainer().classList.toggle("picking-location", !!target),
        );

        // The long-press menu adds questions of every type: for experts
        const unbindMenu = showAllQuestionTypes.subscribe((show) => {
            const menu = (map as any).contextmenu;
            if (show) menu?.enable();
            else menu?.disable();
        });
        // Its texts follow the language of the phone
        const unbindLanguage = language.listen(() => {
            const menu = (map as any).contextmenu;
            menu?.removeAllItems();
            for (const item of longPressMenu()) menu?.addItem(item);
        });

        return () => {
            map.off("click", onClick);
            unbindPicking();
            unbindMenu();
            unbindLanguage();
        };
    }, [map]);

    useEffect(() => {
        if (!map) return;

        const container = map.getContainer();
        const markInteraction = () => {
            lastMapInteractionRef.current = Date.now();
        };
        container.addEventListener("pointerdown", markInteraction);
        container.addEventListener("wheel", markInteraction, {
            passive: true,
        });

        return () => {
            container.removeEventListener("pointerdown", markInteraction);
            container.removeEventListener("wheel", markInteraction);
        };
    }, [map]);

    useEffect(() => {
        const intervalId = setInterval(async () => {
            if (!map) return;
            let layerCount = 0;
            map.eachLayer((layer: any) => {
                if (layer.eliminationGeoJSON) {
                    // Hopefully only geoJSON layers
                    layerCount++;
                }
            });
            if (layerCount > 1) {
                console.log("Too many layers, refreshing...");
                refreshQuestions(false);
            }
        }, 1000);

        return () => clearInterval(intervalId);
    }, [map]);

    useEffect(() => {
        if (!map) return;

        // Your own position: a blue dot with a light circle for its accuracy,
        // above the grey area and the zones but below the question markers
        const pane = map.getPane("myPosition") ?? map.createPane("myPosition");
        pane.style.zIndex = "450";
        pane.style.pointerEvents = "none";
        let dot: L.CircleMarker | null = null;
        let halo: L.Circle | null = null;

        // The map follows the blue dot until you move it yourself
        const stopFollowing = () => followMyPosition.set(false);
        map.on("dragstart", stopFollowing);
        const follow = (latLng: L.LatLngExpression, first: boolean) => {
            if (!followMyPosition.get()) return;
            if (first) {
                map.setView(latLng, Math.max(map.getZoom(), MY_POSITION_ZOOM));
            } else {
                map.panTo(latLng);
            }
        };

        const stopWatching = watchMyPosition();
        const unsubscribe = myPosition.subscribe((position) => {
            if (!position) return;
            const latLng: L.LatLngExpression = [position.lat, position.lng];
            if (dot && halo) {
                dot.setLatLng(latLng);
                halo.setLatLng(latLng).setRadius(position.accuracy);
                follow(latLng, false);
                return;
            }
            follow(latLng, true);
            halo = L.circle(latLng, {
                radius: position.accuracy,
                stroke: false,
                fillColor: "#2563eb",
                fillOpacity: 0.12,
                interactive: false,
                pane: "myPosition",
            }).addTo(map);
            dot = L.circleMarker(latLng, {
                radius: 8,
                color: "#ffffff",
                weight: 3,
                fillColor: "#2563eb",
                fillOpacity: 1,
                interactive: false,
                pane: "myPosition",
            }).addTo(map);
        });

        return () => {
            map.off("dragstart", stopFollowing);
            stopWatching();
            unsubscribe();
            dot?.remove();
            halo?.remove();
        };
    }, [map]);

    return displayMap;
};
