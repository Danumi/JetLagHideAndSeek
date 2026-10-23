import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import type { Position } from "geojson";
import * as L from "leaflet";
import { ChevronRightIcon, LayersIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pane, useMap } from "react-leaflet";

import { mapGeoJSON } from "@/lib/context";
import { placePickedPoint } from "@/lib/gps";
import { hasMessage, t, tr, useLanguage } from "@/lib/i18n";
import { retryTrigger } from "@/lib/loading";
import { cn } from "@/lib/utils";
import {
    findNamedWaterLines,
    findTramLines,
    findTransitLines,
    type TransitLine,
} from "@/maps/api";
import { deckGroups } from "@/maps/deck";
import {
    highlightedLine,
    lineLabelPositions,
    linesAt,
    MAP_LAYERS,
    type MapLayer,
    mapLayer,
    markTooManyPlaces,
    nextTappedLine,
    placesInView,
    placeSymbolHtml,
    shownMapLayers,
    type TappedLine,
    tappedLines,
    toggleMapLayer,
    tooManyPlacesInView,
    waterLabels,
    waterLabelsInView,
} from "@/maps/mapLayers";
import { placesOfKind } from "@/maps/nearest";

import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

/*
 * Places and lines on the map: every museum, park or hospital of the
 * question cards, bodies of water and the U-Bahn, S-Bahn and tram lines. A
 * button below the location button picks what to show.
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
/** Trams below the U-Bahn and S-Bahn lines. */
const TRAMS = { interactive: false, pane: "mapLayerTrams" } as const;
/**
 * Names of lines and waters go into Leaflet's pane for names, above the
 * question pins, so a pin never hides them (like the names of the nearest).
 */
const NAMES_PANE = "tooltipPane";

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
 * and none while there are too many in view (Vienna has about 565 parks).
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

const lineBadgeHtml = (ref: string, color: string) =>
    `<div style="padding:0 4px;border-radius:4px;border:1.5px solid #fff;background:${color};color:#fff;font:700 11px/15px Poppins,sans-serif;box-shadow:0 1px 2px rgba(0,0,0,.4)">${escapeHtml(ref)}</div>`;

const lineLabelIcon = (ref: string, color: string) =>
    L.divIcon({
        className: "",
        iconSize: [34, 18],
        iconAnchor: [17, 9],
        html: `<div style="display:flex;justify-content:center">${lineBadgeHtml(ref, color)}</div>`,
    });

/**
 * An end station of the tapped line: a dot, its name beside it on the side
 * away from the other end, so the two names don't overlap (the S60 has both
 * ends in the south).
 */
const lineEndIcon = (name: string, color: string, side: "left" | "right") =>
    L.divIcon({
        className: "",
        iconSize: [0, 0],
        html: `<div style="position:relative"><div style="position:absolute;left:-6px;top:-6px;width:12px;height:12px;box-sizing:border-box;border-radius:9999px;background:#fff;border:3px solid ${color}"></div><div style="position:absolute;left:0;top:0;transform:translate(${side === "left" ? "calc(-100% - 9px)" : "9px"},-50%);width:max-content;color:#0f172a;font:600 12px/1.2 Poppins,sans-serif;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff">${escapeHtml(name)}</div></div>`,
    });

/** A colour mixed with white, for the lines not tapped. */
const paler = (color: string, white = 0.7) => {
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)?.[1];
    if (!hex) return "#cbd5e1";
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
    const mix = [0, 2, 4].map((i) =>
        Math.round(
            parseInt(full.slice(i, i + 2), 16) * (1 - white) + 255 * white,
        )
            .toString(16)
            .padStart(2, "0"),
    );
    return `#${mix.join("")}`;
};

const colorOf = (line: TransitLine) =>
    line.colour ??
    MAP_LAYERS.find((layer) => layer.route === line.route)?.color ??
    "#334155";

/** The lines drawn on the map, for taps on them: U-Bahn and S-Bahn, trams. */
const drawnLines = new Map<string, TransitLine[]>();
const allDrawnLines = () =>
    ["rail", "tram"].flatMap((id) => drawnLines.get(id) ?? []);
/** Where the last tap on a line was, to go through the lines there. */
let lastLineTap: L.LatLng | null = null;

/** Taps this close together (on screen) are on the same spot. */
const SAME_SPOT_PX = 30;

const tappedLine = (line: TransitLine): TappedLine => ({
    ref: line.ref,
    route: line.route,
    color: colorOf(line),
    from: line.from,
    to: line.to,
});

const clearTappedLines = () => {
    lastLineTap = null;
    tappedLines.set(null);
};

/**
 * A tap on the map near a line that is shown: highlights the line, and the
 * strip above the buttons names it. Each further tap on the same spot picks
 * the next line there (the S-Bahn lines share their tracks). False away from
 * the lines: then the tap is for the zones.
 */
export const tapLineAt = (map: L.Map, at: L.LatLng) => {
    const lines = allDrawnLines();
    const refs = linesAt(lines, [at.lng, at.lat], ([lng, lat]) =>
        map.latLngToContainerPoint([lat, lng]),
    );
    if (refs.length === 0) {
        clearTappedLines();
        return false;
    }

    const last = lastLineTap;
    const shown = highlightedLine();
    lastLineTap = at;
    if (
        last &&
        shown &&
        refs.includes(shown.ref) &&
        map
            .latLngToContainerPoint(last)
            .distanceTo(map.latLngToContainerPoint(at)) <= SAME_SPOT_PX
    ) {
        nextTappedLine();
        return true;
    }
    tappedLines.set({
        lines: refs.map((ref) =>
            tappedLine(lines.find((line) => line.ref === ref)!),
        ),
        shown: 0,
    });
    return true;
};

/**
 * The line tapped on the map, in a strip above the buttons below it rather
 * than on the map: "U4 Heiligenstadt – Hütteldorf", the next line at the
 * same spot and close.
 */
export const TappedLineBar = () => {
    useLanguage();
    const $tapped = useStore(tappedLines);
    const line = highlightedLine($tapped);
    if (!$tapped || !line) return null;

    return (
        <div className="flex max-w-[92vw] items-center gap-2 rounded-2xl bg-background/95 py-1 pl-3 pr-1 text-sm shadow-lg">
            <span
                className="shrink-0"
                dangerouslySetInnerHTML={{
                    __html: lineBadgeHtml(line.ref, line.color),
                }}
            />
            <span className="min-w-0 truncate font-semibold">
                {line.from && line.to
                    ? `${line.from} – ${line.to}`
                    : line.route === "tram"
                      ? t("layers.line.tram")
                      : ""}
            </span>
            {$tapped.lines.length > 1 && (
                <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 shrink-0 gap-0.5 rounded-full px-2"
                    title={t("layers.line.nextTitle")}
                    onClick={nextTappedLine}
                >
                    {t("layers.line.count", {
                        n: $tapped.shown + 1,
                        total: $tapped.lines.length,
                    })}
                    <ChevronRightIcon className="!size-4" />
                </Button>
            )}
            <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 rounded-full"
                title={t("common.close")}
                onClick={clearTappedLines}
            >
                <XIcon className="!size-4" />
            </Button>
        </div>
    );
};

/**
 * Lines in their colours, each with its name: the U-Bahn and S-Bahn ("rail")
 * or the trams. A tapped line is drawn wider on top, the others paler.
 */
const TransitLayer = ({
    id,
    load,
    routes,
    pane,
    weight,
}: {
    id: "rail" | "tram";
    load: () => Promise<TransitLine[]>;
    routes: string;
    pane: typeof LINES | typeof TRAMS;
    weight: number;
}) => {
    const map = useMap();
    const lines = useLayerData(id, load);
    const $selected = highlightedLine(useStore(tappedLines))?.ref;
    // "towards Mödling" at the end of a tapped line
    const $language = useLanguage();
    const shown = useMemo(
        () =>
            lines?.filter((line) => routes.split(",").includes(line.route)) ??
            null,
        [lines, routes],
    );
    const colored = useRef<{ path: L.GeoJSON; color: string }[]>([]);

    useEffect(() => {
        if (!shown) return;
        const group = L.layerGroup().addTo(map);
        // A white edge sets the lines apart from the map below
        for (const line of shown) {
            L.geoJSON(turf.featureCollection(line.lines), {
                ...pane,
                style: { color: "#ffffff", weight: weight + 2.5, opacity: 0.9 },
            }).addTo(group);
        }
        for (const line of [...shown].reverse()) {
            const color = colorOf(line);
            const path = L.geoJSON(turf.featureCollection(line.lines), {
                ...pane,
                style: { color, weight, opacity: 1 },
            }).addTo(group);
            colored.current.push({ path, color });
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
                keyboard: false,
                pane: NAMES_PANE,
            })
                .on("click", (event) => {
                    // "Pick on map": a tap on a name sets the point too
                    if (placePickedPoint(event.latlng)) return;
                    lastLineTap = null;
                    tappedLines.set({ lines: [tappedLine(line)], shown: 0 });
                })
                .addTo(group);
        }
        drawnLines.set(id, shown);

        return () => {
            group.remove();
            colored.current = [];
            drawnLines.delete(id);
            const tapped = highlightedLine();
            if (shown.some((line) => line.ref === tapped?.ref)) {
                clearTappedLines();
            }
        };
    }, [map, shown, id, pane, weight]);

    useEffect(() => {
        if (!$selected || !shown) return;
        // Paler colours rather than see-through: the pieces of a line would
        // overlap in darker dots
        for (const { path, color } of colored.current) {
            path.setStyle({ color: paler(color) });
        }
        const line = shown.find((line) => line.ref === $selected);
        // On top of all lines, trams too
        const highlight =
            line &&
            L.layerGroup([
                L.geoJSON(turf.featureCollection(line.lines), {
                    ...LINES,
                    style: { color: "#ffffff", weight: 10, opacity: 1 },
                }),
                L.geoJSON(turf.featureCollection(line.lines), {
                    ...LINES,
                    style: { color: colorOf(line), weight: 6, opacity: 1 },
                }),
                // Its end stations, small, where they are
                ...(line.ends ?? []).map(({ name, at, beyond }, i, ends) =>
                    L.marker([at[1], at[0]], {
                        icon: lineEndIcon(
                            beyond ? t("layers.line.towards", { name }) : name,
                            colorOf(line),
                            at[0] < ends[1 - i].at[0] ? "left" : "right",
                        ),
                        interactive: false,
                        keyboard: false,
                        pane: NAMES_PANE,
                    }),
                ),
            ]).addTo(map);
        return () => {
            highlight?.remove();
            for (const { path } of colored.current) path.resetStyle();
        };
    }, [map, shown, $selected, $language]);

    return null;
};

const waterLabelIcon = (name: string, color: string) =>
    L.divIcon({
        className: "",
        iconSize: [0, 0],
        html: `<div style="transform:translate(-50%,-50%);width:max-content;color:${color};font:italic 600 12px/1.2 Poppins,sans-serif;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff">${escapeHtml(name)}</div>`,
    });

/** Bodies of water as blue lines with their names ("Alte Donau"). */
const WaterLayer = () => {
    const map = useMap();
    const lines = useLayerData("water", findNamedWaterLines);
    const color = mapLayer("water")!.color;
    useDrawn(lines, (lines) =>
        L.geoJSON(turf.featureCollection(lines), {
            ...LINES,
            style: { color, weight: 2, opacity: 0.8 },
        }),
    );
    const labels = useMemo(() => lines && waterLabels(lines), [lines]);

    useEffect(() => {
        if (!labels) return;
        const group = L.layerGroup().addTo(map);
        const draw = () => {
            group.clearLayers();
            const view = map.getBounds();
            const size = map.getSize();
            const widthKm = turf.distance(
                [view.getWest(), map.getCenter().lat],
                [view.getEast(), map.getCenter().lat],
            );
            const shown = waterLabelsInView(
                labels,
                {
                    south: view.getSouth(),
                    west: view.getWest(),
                    north: view.getNorth(),
                    east: view.getEast(),
                },
                ([lng, lat]) => map.latLngToContainerPoint([lat, lng]),
                size.x / widthKm,
            );
            for (const { name, at } of shown) {
                L.marker([at[1], at[0]], {
                    icon: waterLabelIcon(name, color),
                    interactive: false,
                    keyboard: false,
                    pane: NAMES_PANE,
                }).addTo(group);
            }
        };
        draw();
        map.on("moveend", draw);
        return () => {
            map.off("moveend", draw);
            group.remove();
        };
    }, [map, labels, color]);

    return null;
};

/** What is shown, inside the map. */
export const MapLayersOverlay = () => {
    const $shown = useStore(shownMapLayers);
    const shownRoutes = (routes: string[]) =>
        MAP_LAYERS.filter(
            (layer) =>
                layer.route &&
                routes.includes(layer.route) &&
                $shown.includes(layer.id),
        )
            .map((layer) => layer.route)
            .join(",");
    const rail = shownRoutes(["subway", "train"]);
    const trams = shownRoutes(["tram"]);

    return (
        <>
            {/* Below the grey areas: what is ruled out looks greyed out */}
            <Pane
                name="mapLayerTrams"
                style={{ zIndex: 339, pointerEvents: "none" }}
            >
                {trams && (
                    <TransitLayer
                        id="tram"
                        load={findTramLines}
                        routes={trams}
                        pane={TRAMS}
                        weight={2.5}
                    />
                )}
            </Pane>
            <Pane
                name="mapLayerLines"
                style={{ zIndex: 340, pointerEvents: "none" }}
            >
                {$shown.includes("water") && <WaterLayer />}
                {rail && (
                    <TransitLayer
                        id="rail"
                        load={findTransitLines}
                        routes={rail}
                        pane={LINES}
                        weight={3.5}
                    />
                )}
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
    // Layers that are gone (the high-speed line) don't count
    const $shown = useStore(shownMapLayers).filter((id) => mapLayer(id));
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
