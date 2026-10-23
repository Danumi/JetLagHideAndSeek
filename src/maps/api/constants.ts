import * as turf from "@turf/turf";

import type { APILocations } from "@/maps/schema";

/**
 * Public Overpass servers, asked after the phone's own access (if any). Free,
 * but often slow; maps.mail.ru first, it answered fastest (2026-10-23).
 */
export const PUBLIC_OVERPASS_HOSTS = [
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
];

/**
 * Questions about the nearest place of a kind give up above this many places.
 * Vienna has about 565 named parks.
 */
export const MAX_PLACES_IN_ZONE = 2000;

export const GEOCODER_API = "https://photon.komoot.io/api/";
export const PASTEBIN_API_RAW_URL = "https://pastebin.com/raw/";
export const PASTEBIN_API_RAW_URL_PROXIED =
    "https://cors-anywhere.com/https://pastebin.com/raw/";

export const ICON_COLORS = {
    black: "#3D3D3D",
    blue: "#2A81CB",
    gold: "#FFD326",
    green: "#2AAD27",
    grey: "#7B7B7B",
    orange: "#CB8427",
    red: "#CB2B3E",
    violet: "#9C2BCB",
};

export const LOCATION_FIRST_TAG: {
    [key in APILocations]:
        | "amenity"
        | "tourism"
        | "leisure"
        | "diplomatic"
        | "natural";
} = {
    aquarium: "tourism",
    hospital: "amenity",
    peak: "natural",
    museum: "tourism",
    theme_park: "tourism",
    zoo: "tourism",
    cinema: "amenity",
    library: "amenity",
    golf_course: "leisure",
    consulate: "diplomatic",
    park: "leisure",
};

/** Lower peaks are hills, not mountains (Vienna: the 25 highest of the Wienerwald). */
export const MIN_MOUNTAIN_METERS = 400;

/**
 * What OSM calls a zoo but players don't: petting zoos, farms, butterfly
 * and plant houses. In Vienna that leaves Tiergarten Schönbrunn and Zoo
 * Hirschstetten.
 */
const notAZoo = (tags: Record<string, string>) =>
    ["petting_zoo", "butterfly"].includes(tags.zoo) ||
    tags.landuse === "farmyard" ||
    tags.building === "greenhouse" ||
    tags.attraction === "botanical" ||
    /streichelzoo/i.test(tags.name);

/** Practices that OSM in Vienna has as hospitals (2026-10-23). */
const NOT_HOSPITALS = ["Kinderwunschzentrum", "Wiener Radiologie"];

/**
 * Whether a place from OSM counts in the game. Places without a name don't:
 * nobody can look them up (half of what OSM calls a park in Vienna is an
 * unnamed bit of green). Mountains are the named peaks of at least 400 m.
 */
export const placeCounts = (
    location: APILocations,
    tags: Record<string, string> | undefined,
) => {
    if (!tags?.name) return false;
    if (location === "peak") {
        // "544", "381.9", sometimes "425 m"
        const meters = parseFloat((tags.ele ?? "").replace(",", "."));
        return Number.isFinite(meters) && meters >= MIN_MOUNTAIN_METERS;
    }
    if (location === "zoo") return !notAZoo(tags);
    if (location === "hospital") return !NOT_HOSPITALS.includes(tags.name);
    return true;
};

/** Places of the same name closer than this are one place. */
export const SAME_PLACE_METERS = 500;

const elementCoord = (element: any): [number, number] =>
    element.center
        ? [element.center.lon, element.center.lat]
        : [element.lon, element.lat];

/**
 * One element per place: OSM has some places twice a few metres apart (a
 * point and an outline), which made "Is your nearest museum the same?" say
 * "Different" for the same museum. The first of them stays.
 */
export const withoutDuplicatePlaces = <T extends { tags?: { name?: string } }>(
    elements: T[],
) => {
    const kept: T[] = [];
    for (const element of elements) {
        const name = element.tags?.name;
        const twin =
            name &&
            kept.some(
                (other) =>
                    other.tags?.name === name &&
                    turf.distance(elementCoord(other), elementCoord(element), {
                        units: "meters",
                    }) < SAME_PLACE_METERS,
            );
        if (!twin) kept.push(element);
    }
    return kept;
};

export const BLANK_GEOJSON = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            properties: {},
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [-180, -90],
                        [180, -90],
                        [180, 90],
                        [-180, 90],
                        [-180, -90],
                    ],
                ],
            },
        },
    ],
};
