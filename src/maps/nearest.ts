import * as turf from "@turf/turf";
import type {
    Feature,
    LineString,
    MultiLineString,
    MultiPolygon,
    Polygon,
    Position,
} from "geojson";
import osmtogeojson from "osmtogeojson";

import {
    additionalMapGeoLocations,
    displayHidingZonesOptions,
    mapGeoLocation,
    polyGeoJSON,
} from "@/lib/context";
import { hasMessage, t } from "@/lib/i18n";
import { memoizeAsync } from "@/lib/utils";
import { formatKilometers } from "@/maps/answers";
import {
    type APILocations,
    elevationAt,
    findHighSpeedLines,
    findLandmassIslands,
    findNamedWaterLines,
    findNearestStreet,
    findPlacesOfKind,
    type StationPlace,
} from "@/maps/api";
import {
    ADMIN_LEVEL_NAMES,
    type AdminLevel,
    MATCHING_DECK,
    MEASURING_DECK,
} from "@/maps/deck";
import { extractStationName } from "@/maps/geo-utils";
import { findAdminZoneInfo } from "@/maps/questions/measuring";
import type {
    MatchingQuestion,
    MeasuringQuestion,
    Question,
} from "@/maps/schema";
import {
    findHidingZoneStations,
    findStationPlaces,
    hidingZoneStationsKey,
} from "@/maps/stations";

/*
 * What a matching or measuring question is about, seen from one point: the
 * nearest museum, the Gemeindebezirk you are in, your elevation. The seekers
 * see it on their question and on the map, the hider in the reason for the
 * answer. It uses the same map data as the questions themselves.
 */

type LatLng = { lat: number; lng: number };
type Line = Feature<LineString | MultiLineString>;

export type NearestMark = {
    /** Name next to the mark on the map, as on the sign; none if unnamed. */
    name?: string;
    /** Where the mark goes, [lng, lat]: the nearest point of the thing. */
    at: Position;
    /** Streets, rivers, railway lines and borders are drawn as lines. */
    lines?: Line[];
};

/*
 * No texts in here: they are put together when shown (nearestText), so a
 * phone shows them in its own language.
 */
export type Nearest = {
    /**
     * distance: the nearest of something ("Nearest museum: Albertina, 350 m")
     * inside: the zone the point is in; on: the landmass it is on
     * border: how far the border of its zone is; elevation: above sea level
     */
    kind: "distance" | "inside" | "on" | "border" | "elevation";
    /**
     * What the card asks about: a card id like "museum", "station",
     * "street", "high-speed" or "water"; for zones the admin level name.
     */
    what: string;
    /** Name of the nearest thing (or zone, or island); none if unnamed. */
    name?: string;
    /** Zones: their admin level, as in "Gemeindebezirk Wieden". */
    adminLevel?: AdminLevel;
    /** Station name length: show how many characters the name has. */
    countCharacters?: boolean;
    /** Landmass: on the mainland, not on an island. */
    mainland?: boolean;
    kilometers?: number;
    meters?: number;
    mark?: NearestMark;
};

/** "Gemeindebezirk Wieden"; OSM already calls some "Katastralgemeinde …". */
export const zoneLabel = (adminLevel: AdminLevel, name: string) => {
    const word = ADMIN_LEVEL_NAMES[adminLevel];
    return !word || name.startsWith(word) ? name : `${word} ${name}`;
};

/** "Nearest museum", "Nächstes Museum". */
export const nearestTitle = (what: string) => {
    const key = `nearest.title.${what}`;
    return hasMessage(key) ? t(key) : t("nearest.title.other", { what });
};

const noun = (what: string) => {
    const key = `nearest.noun.${what}`;
    return hasMessage(key) ? t(key) : what;
};

/** The nearest thing, like "Albertina", "an unnamed park" or "Gemeindebezirk Wieden". */
export const nearestName = (nearest: Nearest) => {
    if (nearest.adminLevel !== undefined && nearest.name) {
        return zoneLabel(nearest.adminLevel, nearest.name);
    }
    if (!nearest.name)
        return t("nearest.unnamed", { what: noun(nearest.what) });
    return nearest.countCharacters
        ? t("nearest.characters", {
              name: nearest.name,
              count: nearest.name.length,
          })
        : nearest.name;
};

/**
 * Where the point is, like "in Gemeindebezirk Wieden" or "auf dem Festland";
 * also in the reason for the hider's answer.
 */
export const nearestWhere = (nearest: Nearest) => {
    if (nearest.kind === "on") {
        return nearest.name
            ? t("nearest.onIsland", { name: nearest.name })
            : t(nearest.mainland ? "nearest.mainland" : "nearest.island");
    }
    const key = `nearest.in.${nearest.adminLevel}`;
    return t(hasMessage(key) ? key : "nearest.in", {
        zone: nearestName(nearest),
    });
};

/** One line for the question card, like "Nearest museum: Albertina, 350 m". */
export const nearestText = (nearest: Nearest) => {
    switch (nearest.kind) {
        case "distance":
            return t("nearest.distance", {
                nearest: nearestTitle(nearest.what),
                name: nearestName(nearest),
                distance: formatKilometers(nearest.kilometers ?? 0),
            });
        case "inside":
            return t("nearest.inside", { zone: nearestWhere(nearest) });
        case "on":
            return t("nearest.on", { land: nearestWhere(nearest) });
        case "border":
            return t("nearest.border", {
                distance: formatKilometers(nearest.kilometers ?? 0),
                zone: nearestName(nearest),
            });
        case "elevation":
            return t("nearest.elevation", {
                meters: Math.round(nearest.meters ?? 0),
            });
    }
};

/** The name next to the mark on the map, like "Albertina" or "Wieden border". */
export const markLabel = (nearest: Nearest) => {
    const name = nearest.mark?.name;
    switch (nearest.kind) {
        case "border":
            return t("nearest.borderMark", { name: name ?? "" });
        case "on":
            return name ?? t("nearest.islandMark");
        default:
            return (
                name ?? t("nearest.unnamedMark", { what: noun(nearest.what) })
            );
    }
};

const toPoint = (at: LatLng) => turf.point([at.lng, at.lat]);

/** The nearest of some places to a point. */
export const nearestPlace = <P extends { lat: number; lng: number }>(
    places: P[],
    at: LatLng,
) => {
    let best: { place: P; kilometers: number } | null = null;
    for (const place of places) {
        const kilometers = turf.distance(
            [place.lng, place.lat],
            [at.lng, at.lat],
            { units: "kilometers" },
        );
        if (!best || kilometers < best.kilometers) {
            best = { place, kilometers };
        }
    }
    return best;
};

/** The nearest of some lines to a point, and the nearest point on it. */
export const nearestLine = <L extends Line>(lines: L[], at: LatLng) => {
    let best: { line: L; kilometers: number; at: Position } | null = null;
    for (const line of lines) {
        const snapped = turf.nearestPointOnLine(line, toPoint(at), {
            units: "kilometers",
        });
        if (!best || snapped.properties.dist < best.kilometers) {
            best = {
                line,
                kilometers: snapped.properties.dist,
                at: snapped.geometry.coordinates,
            };
        }
    }
    return best;
};

const outlineOf = (area: Feature<Polygon | MultiPolygon>): Line[] => {
    const outline = turf.polygonToLine(area);
    return outline.type === "FeatureCollection" ? outline.features : [outline];
};

type Place = { name?: string; lat: number; lng: number };

export const placesOfKind = async (location: APILocations): Promise<Place[]> =>
    (await findPlacesOfKind(location)).elements.map((x: any) => ({
        name: x.tags?.name as string | undefined,
        lat: x.center ? x.center.lat : x.lat,
        lng: x.center ? x.center.lon : x.lon,
    }));

export const stationPoints = (stations: StationPlace[]): Place[] =>
    stations.map((station) => ({
        name: extractStationName(station) as string | undefined,
        lat: station.geometry.coordinates[1],
        lng: station.geometry.coordinates[0],
    }));

const nearestOfPlaces = (
    what: string,
    places: Place[],
    at: LatLng,
    countCharacters = false,
): Nearest | null => {
    const best = nearestPlace(places, at);
    if (!best) return null;
    const { name, lat, lng } = best.place;
    return {
        kind: "distance",
        what,
        name: name || undefined,
        countCharacters,
        kilometers: best.kilometers,
        mark: { name: name || undefined, at: [lng, lat] },
    };
};

const nearestOfLines = (
    what: string,
    lines: Line[],
    at: LatLng,
): Nearest | null => {
    const best = nearestLine(lines, at);
    if (!best) return null;
    const name: string | undefined =
        best.line.properties?.name ?? best.line.properties?.ref;
    return {
        kind: "distance",
        what,
        name,
        kilometers: best.kilometers,
        mark: {
            name,
            at: best.at,
            // The whole river or railway line, not just its nearest piece
            lines: name
                ? lines.filter(
                      (line) =>
                          (line.properties?.name ?? line.properties?.ref) ===
                          name,
                  )
                : [best.line],
        },
    };
};

/** "museum" for "museum-full": the card's id, like "amusement-park". */
const placeWhat = (type: string) =>
    [...MATCHING_DECK, ...MEASURING_DECK].find((card) => card.type === type)
        ?.id ?? type.replace(/-full$/, "");

const STATION_TYPES = [
    "same-first-letter-station",
    "same-length-station",
    "same-train-line",
    "rail-measure",
];

const MATCHING_TYPES = [
    "zone",
    "letter-zone",
    "street",
    "landmass",
    "same-first-letter-station",
    "same-length-station",
    "same-train-line",
];

const MEASURING_TYPES = [
    "highspeed-measure-shinkansen",
    "admin-measure",
    "water",
    "sea-level",
    "rail-measure",
];

/** Whether the app can tell what's nearest for this question. */
export const hasNearest = (question: Question) =>
    (question.id === "matching" &&
        (question.data.type.endsWith("-full") ||
            MATCHING_TYPES.includes(question.data.type))) ||
    (question.id === "measuring" &&
        (question.data.type.endsWith("-full") ||
            MEASURING_TYPES.includes(question.data.type)));

const adminLevelOf = (question: MatchingQuestion | MeasuringQuestion) =>
    ((question as { cat?: { adminLevel?: AdminLevel } }).cat?.adminLevel ??
        4) as AdminLevel;

const nearestZone = async (
    question: MatchingQuestion | MeasuringQuestion,
    at: LatLng,
): Promise<Nearest | null> => {
    const level = adminLevelOf(question);
    const zone = await findAdminZoneInfo(at.lat, at.lng, level);
    if (!zone) return null;
    // German names, as on the signs
    const name: string = zone.boundary.properties?.name ?? zone.name;
    const what = ADMIN_LEVEL_NAMES[level] ?? "zone";

    if (question.type !== "admin-measure") {
        return {
            kind: "inside",
            what,
            name,
            adminLevel: level,
            mark: {
                name,
                at: turf.pointOnFeature(zone.boundary).geometry.coordinates,
            },
        };
    }

    const lines = outlineOf(zone.boundary);
    const best = nearestLine(lines, at);
    if (!best) return null;
    return {
        kind: "border",
        what,
        name,
        adminLevel: level,
        kilometers: best.kilometers,
        mark: { name, at: best.at, lines },
    };
};

const nearestLandmass = async (at: LatLng): Promise<Nearest | null> => {
    const islands = await findLandmassIslands();
    const island = islands.find((feature) =>
        turf.booleanPointInPolygon(toPoint(at), feature),
    );
    if (island) {
        const name: string | undefined = island.properties?.name;
        return {
            kind: "on",
            what: "landmass",
            name,
            mark: {
                name,
                at: turf.pointOnFeature(island).geometry.coordinates,
                lines: outlineOf(island),
            },
        };
    }

    // On the mainland: show where the separate landmasses are
    const outlines = islands.flatMap(outlineOf);
    const best = nearestLine(outlines, at);
    return {
        kind: "on",
        what: "landmass",
        mainland: true,
        mark: best
            ? {
                  name: best.line.properties?.name,
                  at: best.at,
                  lines: outlines,
              }
            : undefined,
    };
};

const nearestForMatching = async (
    question: MatchingQuestion,
    at: LatLng,
): Promise<Nearest | null> => {
    if (question.type.endsWith("-full")) {
        const location = question.type.replace(/-full$/, "") as APILocations;
        return nearestOfPlaces(
            placeWhat(question.type),
            await placesOfKind(location),
            at,
        );
    }

    switch (question.type) {
        case "same-first-letter-station":
        case "same-length-station":
        case "same-train-line": {
            if (displayHidingZonesOptions.get().length === 0) return null;
            return nearestOfPlaces(
                "station",
                stationPoints(await findStationPlaces()),
                at,
                question.type === "same-length-station",
            );
        }
        case "street": {
            const street = await findNearestStreet(at.lat, at.lng);
            if (!street) return null;
            return {
                kind: "distance",
                what: "street",
                name: street.name ?? undefined,
                kilometers: street.distance / 1000,
                mark: {
                    name: street.name ?? undefined,
                    at: turf.nearestPointOnLine(street.line, toPoint(at))
                        .geometry.coordinates,
                    lines: [street.line],
                },
            };
        }
        case "zone":
        case "letter-zone":
            return nearestZone(question, at);
        case "landmass":
            return nearestLandmass(at);
        default:
            return null;
    }
};

const nearestForMeasuring = async (
    question: MeasuringQuestion,
    at: LatLng,
): Promise<Nearest | null> => {
    if (question.type.endsWith("-full")) {
        const location = question.type.replace(/-full$/, "") as APILocations;
        return nearestOfPlaces(
            placeWhat(question.type),
            await placesOfKind(location),
            at,
        );
    }

    switch (question.type) {
        case "rail-measure": {
            // The stations the hiding zones are drawn around (Small: U-Bahn)
            const stations = await findHidingZoneStations();
            if (!stations) return null;
            return nearestOfPlaces("station", stationPoints(stations), at);
        }
        case "highspeed-measure-shinkansen":
            return nearestOfLines(
                "high-speed",
                osmtogeojson(await findHighSpeedLines()).features.filter(
                    (feature): feature is Line =>
                        feature.geometry?.type === "LineString" ||
                        feature.geometry?.type === "MultiLineString",
                ),
                at,
            );
        case "water":
            return nearestOfLines("water", await findNamedWaterLines(), at);
        case "admin-measure":
            return nearestZone(question, at);
        case "sea-level": {
            const meters = await elevationAt(at.lat, at.lng);
            if (meters === null) return null;
            return { kind: "elevation", what: "sea-level", meters };
        }
        default:
            return null;
    }
};

const nearestAt = memoizeAsync(
    async (question: Question, at: LatLng): Promise<Nearest | null> => {
        switch (question.id) {
            case "matching":
                return nearestForMatching(question.data, at);
            case "measuring":
                return nearestForMeasuring(question.data, at);
            default:
                return null;
        }
    },
    (question, at) => {
        const data = question.data as {
            type?: string;
            cat?: { adminLevel?: number };
        };
        const $polyGeoJSON = polyGeoJSON.get();
        return JSON.stringify({
            id: question.id,
            type: data.type,
            level: data.cat?.adminLevel,
            at: [at.lat.toFixed(6), at.lng.toFixed(6)],
            stations: STATION_TYPES.includes(data.type ?? "")
                ? hidingZoneStationsKey()
                : undefined,
            // The places are those of the game area
            area: [
                mapGeoLocation.get().properties.osm_id,
                additionalMapGeoLocations
                    .get()
                    .map((x) => [x.location.properties.osm_id, x.added]),
                $polyGeoJSON ? turf.bbox($polyGeoJSON) : null,
            ],
        });
    },
);

/**
 * What the question is about, seen from `at` (default: where it was asked).
 * Null if the app can't tell for this question or nothing was found.
 */
export const findNearest = async (
    question: Question,
    at?: LatLng,
): Promise<Nearest | null> => {
    if (!hasNearest(question)) return null;
    const data = question.data as { lat: number; lng: number };
    return nearestAt(question, at ?? { lat: data.lat, lng: data.lng });
};
