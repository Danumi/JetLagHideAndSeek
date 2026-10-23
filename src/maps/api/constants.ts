import type { APILocations } from "@/maps/schema";

export const OVERPASS_HOSTS = {
    "overpass-api.de (official; often slow)":
        "https://overpass-api.de/api/interpreter",
    "private.coffee (unofficial; backup)":
        "https://overpass.private.coffee/api/interpreter",
    "maps.mail.ru (unofficial; fast but sometimes unavailable)":
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
} as const;

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
    return true;
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
