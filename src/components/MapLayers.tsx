import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import type { Feature, LineString, MultiLineString, Position } from "geojson";
import * as L from "leaflet";
import { LayersIcon } from "lucide-react";
import osmtogeojson from "osmtogeojson";
import { useEffect, useState } from "react";
import { Pane, useMap } from "react-leaflet";

import { mapGeoJSON } from "@/lib/context";
import { placePickedPoint } from "@/lib/gps";
import { hasMessage, t, tr, useLanguage } from "@/lib/i18n";
import { retryTrigger } from "@/lib/loading";
import { cn } from "@/lib/utils";
import {
    findHighSpeedLines,
    findNamedWaterLines,
    findTransitLines,
} from "@/maps/api";
import { deckGroups } from "@/maps/deck";
import {
    lineLabelPositions,
    MAP_LAYERS,
    type MapLayer,
    mapLayer,
    markTooManyPlaces,
    placesInView,
    placeSymbolHtml,
    shownMapLayers,
    toggleMapLayer,
    tooManyPlacesInView,
} from "@/maps/mapLayers";
import { placesOfKind } from "@/maps/nearest";

import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

/*
 * Places and lines on the map: every museum, park or hospital of the
 * question cards, bodies of water, the high-speed line and the U-Bahn and
 * S-Bahn lines. A button below the location button picks what to show.
 */

const escapeHtml = (text: string) =>
    text.replace(
        /[&<>"']/g,
        (char) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[char]!,
    );

const isLine = (
    feature: Feature,
): feature is Feature<LineString | MultiLineString> =>
    feature.geometry?.type === "LineString" ||
    feature.geometry?.type === "MultiLineString";

/**
 * A layer's data, once the game area is known. The queries are those of the
 * questions, so "New Game" has usually loaded them already; "Retry" loads
 * them again after a failure.
 */
const useLayerData = <T,>(id: string, load: () => Promise<T>) => {
    const $area = useStore(mapGeoJSON);
    const $retry = useStore(retryTrigger);
    const [data, setData] = useState<T | null>(null);

    useEffect(() => {
        setData(null);
        if (!$area) return;
        let current = true;
        load().then(
            (result) => current && setData(result),
            // The player was offered a retry
            (error) => console.log(error),
        );
        return () => {
            current = false;
        };
    }, [id, $area, $retry]);

    return data;
};

/** Adds what `draw` makes of the data to the map, while it is shown. */
const useDrawn = <T,>(
    data: T | null,
    draw: (data: T) => L.Layer,
    deps: unknown[] = [],
) => {
    const map = useMap();
    useEffect(() => {
        if (!data) return;
        const layer = draw(data).addTo(map);
        return () => {
            layer.remove();
        };
    }, [map, data, ...deps]);
};

const LINES = { interactive: false, pane: "mapLayerLines" } as const;

/** "Albertina" and "Museum" when a place is tapped. */
const showPlace = (
    map: L.Map,
    layer: MapLayer,
    place: { name?: string; lat: number; lng: number },
) => {
    const noun = `nearest.noun.${layer.id}`;
    const content = document.createElement("div");
    const name = document.createElement("div");
    name.className = "font-semibold";
    name.textContent =
        place.name ??
        t("nearest.unnamedMark", {
            what: hasMessage(noun) ? t(noun) : tr(layer.label),
        });
    content.append(name);
    if (place.name) {
        const kind = document.createElement("div");
        kind.textContent = tr(layer.label);
        content.append(kind);
    }
    L.popup({ offset: [0, -8], closeButton: false, autoPan: false })
        .setLatLng([place.lat, place.lng])
        .setContent(content)
        .openOn(map);
};

/**
 * Every place of a kind as a small symbol. Only those in view are drawn,
 * and none while there are too many in view (Vienna has about 1,150 parks).
 */
const PlaceLayer = ({ layer }: { layer: MapLayer }) => {
    const map = useMap();
    const places = useLayerData(layer.id, () => placesOfKind(layer.location!));

    useEffect(() => {
        if (!places) return;
        const group = L.layerGroup().addTo(map);
        const icon = L.divIcon({
            className: "",
            iconSize: [22, 22],
            iconAnchor: [11, 11],
            html: placeSymbolHtml(layer, 22),
        });

        const draw = () => {
            group.clearLayers();
            const view = map.getBounds().pad(0.2);
            const shown = placesInView(places, {
                south: view.getSouth(),
                west: view.getWest(),
                north: view.getNorth(),
                east: view.getEast(),
            });
            markTooManyPlaces(layer.id, shown === null);
            for (const place of shown ?? []) {
                L.marker([place.lat, place.lng], {
                    icon,
                    keyboard: false,
                    pane: "mapLayerPlaces",
                })
                    .on("click", (event) => {
                        // "Pick on map": a tap on a place sets the point too
                        if (placePickedPoint(event.latlng)) return;
                        showPlace(map, layer, place);
                    })
                    .addTo(group);
            }
        };
        draw();
        map.on("moveend", draw);

        return () => {
            map.off("moveend", draw);
            group.remove();
            markTooManyPlaces(layer.id, false);
        };
    }, [map, places, layer]);

    return null;
};

const lineLabelIcon = (ref: string, color: string) =>
    L.divIcon({
        className: "",
        iconSize: [34, 18],
        iconAnchor: [17, 9],
        html: `<div style="display:flex;justify-content:center"><div style="padding:0 4px;border-radius:4px;border:1.5px solid #fff;background:${color};color:#fff;font:700 11px/15px Poppins,sans-serif;box-shadow:0 1px 2px rgba(0,0,0,.4)">${escapeHtml(ref)}</div></div>`,
    });

/** The U-Bahn and S-Bahn lines in their colours, each with its name. */
const TransitLayer = ({ routes }: { routes: string }) => {
    const lines = useLayerData("transit", findTransitLines);

    useDrawn(
        lines,
        (lines) => {
            const shown = lines.filter((line) =>
                routes.split(",").includes(line.route),
            );
            const colorOf = (line: (typeof shown)[number]) =>
                line.colour ??
                MAP_LAYERS.find((layer) => layer.route === line.route)?.color ??
                "#334155";
            const group = L.layerGroup();
            // A white edge sets the lines apart from the map below
            for (const line of shown) {
                L.geoJSON(turf.featureCollection(line.lines), {
                    ...LINES,
                    style: { color: "#ffffff", weight: 6, opacity: 0.9 },
                }).addTo(group);
            }
            for (const line of [...shown].reverse()) {
                L.geoJSON(turf.featureCollection(line.lines), {
                    ...LINES,
                    style: { color: colorOf(line), weight: 3.5, opacity: 1 },
                }).addTo(group);
            }
            const area = mapGeoJSON.get();
            const inArea = (at: Position) =>
                !area ||
                area.features.some((feature) =>
                    turf.booleanPointInPolygon(at, feature),
                );
            for (const { ref, at } of lineLabelPositions(shown, inArea)) {
                const line = shown.find((line) => line.ref === ref)!;
                L.marker([at[1], at[0]], {
                    icon: lineLabelIcon(ref, colorOf(line)),
                    interactive: false,
                    keyboard: false,
                    pane: "mapLayerPlaces",
                }).addTo(group);
            }
            return group;
        },
        [routes],
    );

    return null;
};

const WaterLayer = () => {
    const lines = useLayerData("water", findNamedWaterLines);
    useDrawn(lines, (lines) =>
        L.geoJSON(turf.featureCollection(lines), {
            ...LINES,
            style: { color: mapLayer("water")!.color, weight: 2, opacity: 0.8 },
        }),
    );
    return null;
};

const findHighSpeedLineFeatures = async () =>
    osmtogeojson(await findHighSpeedLines()).features.filter(isLine);

const HighSpeedLayer = () => {
    const lines = useLayerData("high-speed", findHighSpeedLineFeatures);
    useDrawn(lines, (lines) =>
        L.geoJSON(turf.featureCollection(lines), {
            ...LINES,
            style: {
                color: mapLayer("high-speed")!.color,
                weight: 4,
                dashArray: "10 6",
            },
        }),
    );
    return null;
};

/** What is shown, inside the map. */
export const MapLayersOverlay = () => {
    const $shown = useStore(shownMapLayers);
    const routes = MAP_LAYERS.filter(
        (layer) => layer.route && $shown.includes(layer.id),
    )
        .map((layer) => layer.route)
        .join(",");

    return (
        <>
            {/* Below the grey areas: what is ruled out looks greyed out */}
            <Pane
                name="mapLayerLines"
                style={{ zIndex: 340, pointerEvents: "none" }}
            >
                {$shown.includes("water") && <WaterLayer />}
                {$shown.includes("high-speed") && <HighSpeedLayer />}
                {routes && <TransitLayer routes={routes} />}
            </Pane>
            {/* Above the grey areas and the nearest places, below the blue dot */}
            <Pane name="mapLayerPlaces" style={{ zIndex: 430 }}>
                {MAP_LAYERS.filter(
                    (layer) => layer.location && $shown.includes(layer.id),
                ).map((layer) => (
                    <PlaceLayer key={layer.id} layer={layer} />
                ))}
            </Pane>
        </>
    );
};

const LayerSymbol = ({ layer }: { layer: MapLayer }) => {
    if (layer.location) {
        return (
            <span
                className="shrink-0"
                dangerouslySetInnerHTML={{ __html: placeSymbolHtml(layer, 22) }}
            />
        );
    }
    const colors = layer.colors ?? [layer.color];
    return (
        <span className="flex h-[22px] w-[22px] shrink-0 flex-col justify-center gap-px">
            {colors.map((color) => (
                <span
                    key={color}
                    className="block w-full rounded-full"
                    style={{
                        background: color,
                        height: colors.length > 1 ? 2 : 4,
                    }}
                />
            ))}
        </span>
    );
};

/** The button below the location button and its list of places and lines. */
export const MapLayersButton = () => {
    useLanguage();
    const $shown = useStore(shownMapLayers);
    const $tooMany = useStore(tooManyPlacesInView);

    const tooMany = MAP_LAYERS.filter((layer) => $tooMany.includes(layer.id));

    return (
        <div className="relative">
            <Popover modal>
                <PopoverTrigger asChild>
                    <Button
                        size="icon"
                        variant="outline"
                        className={cn(
                            "h-11 w-11 rounded-full bg-background/95 text-foreground shadow-lg",
                            $shown.length > 0 && "text-blue-500",
                        )}
                        title={t("layers.button")}
                        aria-pressed={$shown.length > 0}
                    >
                        <LayersIcon className="!size-5" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    side="left"
                    align="start"
                    className="max-h-[70svh] w-64 overflow-y-auto p-3"
                >
                    <h2 className="font-poppins text-base font-semibold">
                        {t("layers.title")}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        {t("layers.hint")}
                    </p>
                    {$shown.length > 0 && (
                        <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 pt-1 text-xs text-blue-500"
                            onClick={() => shownMapLayers.set([])}
                        >
                            {t("layers.hideAll")}
                        </Button>
                    )}
                    {deckGroups(MAP_LAYERS).map(({ group, cards: layers }) => (
                        <div key={group.en} className="mt-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {tr(group)}
                            </div>
                            {layers.map((layer) => (
                                <label
                                    key={layer.id}
                                    className="flex cursor-pointer items-center gap-2 py-1.5 text-sm"
                                >
                                    <Checkbox
                                        checked={$shown.includes(layer.id)}
                                        onCheckedChange={(checked) =>
                                            toggleMapLayer(
                                                layer.id,
                                                checked === true,
                                            )
                                        }
                                    />
                                    <LayerSymbol layer={layer} />
                                    <span>{tr(layer.label)}</span>
                                </label>
                            ))}
                        </div>
                    ))}
                </PopoverContent>
            </Popover>
            {tooMany.length > 0 && (
                <div className="pointer-events-none absolute right-0 top-full mt-2 w-max max-w-[11rem] rounded-2xl bg-background/95 px-3 py-1.5 text-right text-xs shadow-lg">
                    {t("layers.zoomIn", {
                        what: tooMany
                            .map((layer) => tr(layer.label))
                            .join(", "),
                    })}
                </div>
            )}
        </div>
    );
};
