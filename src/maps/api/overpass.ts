import * as turf from "@turf/turf";
import type {
    Feature,
    FeatureCollection,
    LineString,
    MultiPolygon,
    Polygon,
    Position,
} from "geojson";
import _ from "lodash";
import osmtogeojson from "osmtogeojson";

import {
    additionalMapGeoLocations,
    mapGeoJSON,
    mapGeoLocation,
    polyGeoJSON,
} from "@/lib/context";
import { t } from "@/lib/i18n";
import { showLoadError, trackLoading } from "@/lib/loading";
import { overpassHosts, refuseOverpassHost } from "@/lib/overpassAccess";
import { memoizeAsync } from "@/lib/utils";
import { safeUnion } from "@/maps/geo-utils";

import { cacheFetch, determineCache } from "./cache";
import { LOCATION_FIRST_TAG, placeCounts } from "./constants";
import { prettifyLocation } from "./geo";
import { packagedResponse } from "./mapDataPackage";
import type {
    APILocations,
    EncompassingTentacleQuestionSchema,
    HomeGameMatchingQuestions,
    HomeGameMeasuringQuestions,
    QuestionSpecificLocation,
} from "./types";
import { CacheType } from "./types";

type TentacleLocationQuery = Pick<
    EncompassingTentacleQuestionSchema,
    "lat" | "lng" | "radius" | "unit" | "locationType"
>;

/**
 * If a server has not answered after this long, the next server is asked in
 * parallel. The slow request keeps running; whichever answers first wins.
 */
const OVERPASS_HEDGE_MS = 10_000;

/**
 * Without any answer after this long the servers count as hanging. Our
 * slowest queries are allowed 60 s on the server.
 */
const OVERPASS_GIVE_UP_MS = 60_000;

/**
 * A server that is busy (too many queries at once, e.g. one at a time on the
 * free plan of overpass.ch) is asked again after Retry-After or this long.
 */
const OVERPASS_BUSY_RETRY_MS = 2_000;
const OVERPASS_BUSY_RETRIES = 5;

const isBusy = (response: Response) =>
    response.status === 429 || response.status === 503;

const busyDelay = (response: Response) => {
    const seconds = Number(response.headers.get("Retry-After"));
    return seconds > 0
        ? Math.min(seconds * 1000, OVERPASS_GIVE_UP_MS)
        : OVERPASS_BUSY_RETRY_MS;
};

/** Map data that couldn't be loaded; the player has been told and can retry. */
export class OverpassError extends Error {}

/** Overpass answers 200 with this remark when a query timed out or ran out of memory. */
const isRuntimeError = (data: any) =>
    typeof data?.remark === "string" && data.remark.startsWith("runtime error");

const findCachedResponse = async (urls: string[], cacheType: CacheType) => {
    try {
        const cache = await determineCache(cacheType);
        for (const url of urls) {
            const cached = await cache.match(url);
            if (cached?.ok) return { response: cached.clone(), url };
        }
    } catch {
        // Cache API unavailable; just fetch.
    }
    return null;
};

const forgetCached = async (url: string, cacheType: CacheType) => {
    try {
        const cache = await determineCache(cacheType);
        await cache.delete(url);
    } catch {
        // Cache API unavailable
    }
};

const firstOkResponse = (
    urls: string[],
    cacheType: CacheType,
): Promise<{
    response: Response | null;
    url: string | null;
    timedOut: boolean;
}> =>
    new Promise((resolve) => {
        let next = 0;
        let running = 0;
        let settled = false;
        let lastResponse: Response | null = null;
        let hedgeTimer: ReturnType<typeof setTimeout> | undefined;
        const busyRetries = new Map<string, number>();

        const finish = (
            response: Response | null,
            url: string | null,
            timedOut = false,
        ) => {
            if (settled) return;
            settled = true;
            clearTimeout(hedgeTimer);
            clearTimeout(giveUpTimer);
            resolve({ response, url, timedOut });
        };

        // Requests still running keep going: a late answer is cached for a retry
        const giveUpTimer = setTimeout(
            () => finish(lastResponse, null, true),
            OVERPASS_GIVE_UP_MS,
        );

        const request = (url: string) => {
            running++;
            cacheFetch(url, undefined, cacheType)
                .then((response) => {
                    if (response.ok) {
                        finish(response, url);
                        return;
                    }
                    lastResponse = response;
                    if (response.status === 401 || response.status === 403) {
                        refuseOverpassHost(url);
                    }
                    const retries = busyRetries.get(url) ?? 0;
                    if (isBusy(response) && retries < OVERPASS_BUSY_RETRIES) {
                        // Ask the same server again shortly; the scheduled
                        // retry counts as running
                        busyRetries.set(url, retries + 1);
                        running++;
                        setTimeout(() => {
                            running--;
                            if (!settled) request(url);
                        }, busyDelay(response));
                    } else {
                        launch();
                    }
                })
                .catch(() => launch())
                .finally(() => {
                    running--;
                    if (!settled && running === 0 && next >= urls.length) {
                        finish(lastResponse, null);
                    }
                });
        };

        const launch = () => {
            if (settled || next >= urls.length) return;
            const url = urls[next++];
            clearTimeout(hedgeTimer);
            if (next < urls.length) {
                hedgeTimer = setTimeout(launch, OVERPASS_HEDGE_MS);
            }
            request(url);
        };

        launch();
    });

/**
 * The answer to a query from the map data package, kept in the cache like an
 * answer from a server; null if the package doesn't have it.
 */
const fromPackage = async (
    query: string,
    url: string,
    cacheType: CacheType,
    loadingText?: string,
) => {
    const response = await trackLoading(loadingText, packagedResponse(query));
    if (!response) return null;
    try {
        const data = await response.clone().json();
        if (isRuntimeError(data)) return null;
        try {
            const cache = await determineCache(cacheType);
            await cache.put(url, response);
        } catch {
            // Caching is best-effort.
        }
        return data;
    } catch {
        return null;
    }
};

/**
 * Runs an Overpass query, from the cache if possible. If no server delivers,
 * the player sees one error message with "Retry" and this throws an
 * OverpassError, so nothing is computed from missing data.
 */
export const getOverpassData = async (
    query: string,
    loadingText?: string,
    cacheType: CacheType = CacheType.CACHE,
) => {
    const encodedQuery = encodeURIComponent(query);
    const urls = overpassHosts().map((base) => `${base}?data=${encodedQuery}`);

    const cached = await findCachedResponse(urls, cacheType);
    if (cached) {
        try {
            const data = await cached.response.json();
            if (!isRuntimeError(data)) return data;
        } catch {
            // Unreadable; load it again
        }
        await forgetCached(cached.url, cacheType);
    }

    const packaged = await fromPackage(query, urls[0], cacheType, loadingText);
    if (packaged) return packaged;

    const { response, url, timedOut } = await trackLoading(
        loadingText,
        firstOkResponse(urls, cacheType),
    );

    if (!response || !response.ok || !url) {
        showLoadError(
            loadingText,
            timedOut
                ? t("loading.timeout")
                : response
                  ? t("loading.status", {
                        status: `${response.status} ${response.statusText}`,
                    })
                  : t("loading.unreachable"),
        );
        throw new OverpassError(
            `Overpass request failed${response ? `: ${response.status}` : ""}`,
        );
    }

    let data;
    try {
        data = await response.clone().json();
    } catch {
        data = null;
    }
    if (!data || isRuntimeError(data)) {
        // Don't keep a broken answer: a retry should ask again
        await forgetCached(url, cacheType);
        showLoadError(loadingText, t("loading.gaveUp"));
        throw new OverpassError(data?.remark ?? "Invalid Overpass response");
    }

    if (url !== urls[0]) {
        try {
            const cache = await determineCache(cacheType);
            await cache.put(urls[0], response);
        } catch {
            // Caching is best-effort.
        }
    }

    return data;
};

export const determineGeoJSON = async (
    osmId: string,
    osmTypeLetter: "W" | "R" | "N",
): Promise<any> => {
    const osmTypeMap: { [key: string]: string } = {
        W: "way",
        R: "relation",
        N: "node",
    };
    const osmType = osmTypeMap[osmTypeLetter];
    const query = `[out:json];${osmType}(${osmId});out geom;`;
    const data = await getOverpassData(
        query,
        t("loading.mapData"),
        CacheType.PERMANENT_CACHE,
    );
    const geo = osmtogeojson(data);
    return {
        ...geo,
        features: geo.features.filter(
            (feature: any) => feature.geometry.type !== "Point",
        ),
    };
};

export const findTentacleLocations = async (
    question: TentacleLocationQuery,
    text: string = t("loading.tentacles"),
) => {
    const query = `
[out:json][timeout:25];
nwr["${LOCATION_FIRST_TAG[question.locationType]}"="${question.locationType}"](around:${turf.convertLength(
        question.radius,
        question.unit,
        "meters",
    )}, ${question.lat}, ${question.lng});
out center;
    `;
    const data = await getOverpassData(query, text);
    const elements = data.elements;
    const response = turf.points([]);
    elements.forEach((element: any) => {
        if (!placeCounts(question.locationType, element.tags)) return;
        if (element.lat && element.lon) {
            const name = element.tags["name:en"] ?? element.tags["name"];
            if (
                response.features.find(
                    (feature: any) => feature.properties.name === name,
                )
            )
                return;
            response.features.push(
                turf.point([element.lon, element.lat], { name }),
            );
        }
        if (!element.center || !element.center.lon || !element.center.lat)
            return;
        const name = element.tags["name:en"] ?? element.tags["name"];
        if (
            response.features.find(
                (feature: any) => feature.properties.name === name,
            )
        )
            return;
        response.features.push(
            turf.point([element.center.lon, element.center.lat], { name }),
        );
    });
    return response;
};

type AdminLevel = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * The outlines of all administrative areas of a level that lie in the game
 * area (with its margin), e.g. the 23 Gemeindebezirke of Vienna. Two queries
 * that don't depend on where a question is asked, so they can be preloaded
 * and come with the map data package: the areas around the game area with
 * their bounds, then the outlines of those inside it (not Lower Austria's).
 */
export const findAdminAreas = memoizeAsync(
    async (
        adminLevel: AdminLevel,
    ): Promise<Feature<Polygon | MultiPolygon>[]> => {
        const bboxValue = gameAreaBbox();
        if (!bboxValue) return [];
        const [s, w, n, e] = bboxValue.split(",").map(Number);
        const around = await getOverpassData(
            `[out:json][timeout:60];rel(${bboxValue})["admin_level"="${adminLevel}"];out tags bb;`,
            t("loading.zone"),
        );
        const ids = (around.elements ?? [])
            .filter(
                ({ bounds }: { bounds?: Record<string, number> }) =>
                    bounds &&
                    bounds.minlat >= s &&
                    bounds.minlon >= w &&
                    bounds.maxlat <= n &&
                    bounds.maxlon <= e,
            )
            .map(({ id }: { id: number }) => id)
            .sort((a: number, b: number) => a - b);
        if (ids.length === 0) return [];
        const data = await getOverpassData(
            `[out:json][timeout:180];rel(id:${ids.join(",")});out geom;`,
            t("loading.zone"),
        );
        return osmtogeojson(data).features.filter(
            (feature): feature is Feature<Polygon | MultiPolygon> =>
                feature.geometry?.type === "Polygon" ||
                feature.geometry?.type === "MultiPolygon",
        );
    },
    (adminLevel) => `${adminLevel}:${gameAreaBbox()}`,
);

/** The administrative area of a level that a point lies in. */
export const findAdminBoundary = async (
    latitude: number,
    longitude: number,
    adminLevel: AdminLevel,
) => {
    const point = turf.point([longitude, latitude]);
    const area = (await findAdminAreas(adminLevel)).find((feature) =>
        turf.booleanPointInPolygon(point, feature),
    );
    if (area) return area;

    // Outside the game area: the server knows which area the point is in
    const query = `
[out:json];
is_in(${latitude}, ${longitude})->.a;
rel(pivot.a)["admin_level"="${adminLevel}"];
out geom;
    `;
    const data = await getOverpassData(query, t("loading.zone"));
    const geo = osmtogeojson(data);
    return geo.features?.[0];
};

export const fetchCoastline = async () => {
    const response = await cacheFetch(
        import.meta.env.BASE_URL + "/coastline50.geojson",
        t("loading.coastline"),
        CacheType.PERMANENT_CACHE,
    );
    const data = await response.json();
    return data;
};

/** Overpass bounding-box filter around the current game area, e.g. "(s,w,n,e)". */
const gameAreaBbox = (margin = 0.02) => {
    const data = mapGeoJSON.get() ?? polyGeoJSON.get();
    if (!data) return null;
    const [w, s, e, n] = turf.bbox(data);
    return [s - margin, w - margin, n + margin, e + margin]
        .map((x) => x.toFixed(4))
        .join(",");
};

const STATION_FILTER = '["railway"~"^(station|halt)$"]';
const LINE_ROUTE_FILTER =
    '["type"="route"]["route"~"^(subway|train|light_rail|tram|monorail|bus|trolleybus)$"]';
const LINE_ORDER = [
    "subway",
    "light_rail",
    "train",
    "monorail",
    "tram",
    "trolleybus",
    "bus",
];

export interface StationLine {
    /** Stable identifier, e.g. "subway:U4". */
    key: string;
    /** What players see, e.g. "U4"; "D" for tram D, "13A" for bus 13A. */
    label: string;
    route: string;
    /** OSM node ids of the stations this line stops at (inside the game area). */
    stationIds: number[];
}

/**
 * Each line of the route set `.routes` with the stations it stops at: those
 * in its route relation, sharing a stop area with one of its stops or
 * platforms, or within 150 m of one (stations that are not linked in OSM,
 * and interchanges like U-Bahn and S-Bahn Praterstern).
 */
const routeStationsQuery = () => {
    const bboxValue = gameAreaBbox();
    const bbox = bboxValue ? `(${bboxValue})` : "";
    const roles = [
        "stop",
        "stop_entry_only",
        "stop_exit_only",
        "platform",
        "platform_entry_only",
        "platform_exit_only",
    ];
    const members = [
        ...roles.map((role) => `node(r.rt:"${role}")${bbox};`),
        ...roles.slice(3).map((role) => `way(r.rt:"${role}")${bbox};`),
        `node(r.rt:"")${STATION_FILTER}${bbox};`,
    ].join("");
    return `foreach.routes->.rt(
.rt out tags;
(${members})->.rm;
(rel(bn.rm)["public_transport"="stop_area"];rel(bw.rm)["public_transport"="stop_area"];)->.rsa;
(node(r.rsa)${STATION_FILTER};node.rm${STATION_FILTER};node(around.rm:150)${STATION_FILTER};);
out ids;
);`;
};

/** The answer to a query with `routeStationsQuery`, by line. */
const parseStationLines = (data: any): StationLine[] => {
    const lines = new Map<string, StationLine>();
    let current: StationLine | null = null;
    for (const element of data.elements ?? []) {
        if (element.type === "relation") {
            const tags = element.tags ?? {};
            const label = tags.ref || tags.name || `#${element.id}`;
            const key = `${tags.route}:${label}`;
            current = lines.get(key) ?? {
                key,
                label,
                route: tags.route,
                stationIds: [],
            };
            lines.set(key, current);
        } else if (element.type === "node" && current) {
            current.stationIds.push(element.id);
        }
    }
    return [...lines.values()];
};

/** Lines found twice as one, with the stations of both; in a fixed order. */
const mergeStationLines = (...found: StationLine[][]) => {
    const lines = new Map<string, StationLine>();
    for (const line of found.flat()) {
        const known = lines.get(line.key);
        lines.set(line.key, {
            ...line,
            stationIds: _.uniq([
                ...(known?.stationIds ?? []),
                ...line.stationIds,
            ]),
        });
    }
    return [...lines.values()].sort(
        (a, b) =>
            LINE_ORDER.indexOf(a.route) - LINE_ORDER.indexOf(b.route) ||
            a.label.localeCompare(b.label, undefined, { numeric: true }),
    );
};

/**
 * All lines that stop at a station (trains, trams and buses), each with the
 * stations it stops at.
 */
export const findStationLines = async (
    node: string,
): Promise<StationLine[]> => {
    const nodeId = node.split("/")[1];
    const query = `
[out:json][timeout:60];
node(${nodeId})->.s;
rel(bn.s)["public_transport"="stop_area"]->.sa;
(node(r.sa);way(r.sa);)->.sam;
(node(around.s:150)["public_transport"~"^(stop_position|platform)$"];way(around.s:150)["public_transport"="platform"];)->.near;
(rel(bn.s)${LINE_ROUTE_FILTER};rel(bn.sam)${LINE_ROUTE_FILTER};rel(bw.sam)${LINE_ROUTE_FILTER};rel(bn.near)${LINE_ROUTE_FILTER};rel(bw.near)${LINE_ROUTE_FILTER};)->.routes;
${routeStationsQuery()}`;

    const data = await getOverpassData(
        query,
        t("loading.lines"),
        CacheType.ZONE_CACHE,
    );
    return mergeStationLines(parseStationLines(data));
};

/** A line runs this close to the seekers when they are riding it. */
const RIDING_METERS = 100;

/**
 * The lines the seekers may be riding: those whose tracks or roads run
 * close to them, or with a stop close by. Buses mostly don't pass the
 * nearest station.
 */
export const findLinesNear = async (
    lat: number,
    lng: number,
): Promise<StationLine[]> => {
    const at = `${RIDING_METERS},${lat.toFixed(5)},${lng.toFixed(5)}`;
    const query = `
[out:json][timeout:60];
(way(around:${at})["highway"];way(around:${at})["railway"];node(around:${at})["public_transport"~"^(stop_position|platform)$"];)->.near;
(rel(bw.near)${LINE_ROUTE_FILTER};rel(bn.near)${LINE_ROUTE_FILTER};)->.routes;
${routeStationsQuery()}`;

    const data = await getOverpassData(query, t("loading.lines"));
    return mergeStationLines(parseStationLines(data));
};

/**
 * The lines to choose from for "Transit Line": those at the seekers' nearest
 * station and those running where the seekers are.
 */
export const findSeekerLines = async (
    node: string,
    at?: { lat: number; lng: number },
) =>
    mergeStationLines(
        ...(await Promise.all([
            findStationLines(node),
            at ? findLinesNear(at.lat, at.lng) : [],
        ])),
    );

/**
 * Station node ids that count as being on the seekers' line.
 *
 * Per the rules the seekers name the one line they are riding (`lineKey`),
 * one of the lines at their nearest station or where they are (`at`).
 * Without a chosen line only certain eliminations are made: "same" keeps
 * every station on any of those lines, "different" only removes stations
 * served by all of them.
 */
export const trainLineNodeFinder = async (
    node: string,
    lineKey?: string,
    same = true,
    at?: { lat: number; lng: number },
): Promise<number[]> => {
    const lines = await findSeekerLines(node, at);
    if (lines.length === 0) return [];

    const chosen = lines.find((line) => line.key === lineKey);
    if (chosen) return chosen.stationIds;

    if (same) return _.uniq(lines.flatMap((line) => line.stationIds));
    return _.intersection(...lines.map((line) => line.stationIds));
};

/** Ways and relation members as lines, each with its name (a river's for its parts). */
const toLineStrings = (
    elements: any[],
): Feature<LineString, { name?: string }>[] => {
    const geometries: {
        name?: string;
        points: { lat: number; lon: number }[];
    }[] = [];
    for (const element of elements) {
        const name: string | undefined = element.tags?.name;
        if (element.type === "way" && element.geometry) {
            geometries.push({ name, points: element.geometry });
        } else if (element.type === "relation" && element.members) {
            for (const member of element.members) {
                if (member.geometry) {
                    geometries.push({ name, points: member.geometry });
                }
            }
        }
    }

    const lines: Feature<LineString, { name?: string }>[] = [];
    for (const { name, points } of geometries) {
        // Clipped geometries contain gaps (null) where the way leaves the bbox.
        let run: [number, number][] = [];
        for (const point of points) {
            if (point && typeof point.lon === "number") {
                run.push([point.lon, point.lat]);
            } else {
                if (run.length >= 2) lines.push(turf.lineString(run, { name }));
                run = [];
            }
        }
        if (run.length >= 2) lines.push(turf.lineString(run, { name }));
    }
    return lines;
};

const STREET_FILTER =
    '["highway"]["highway"!~"^(motorway|motorway_link|proposed|construction|platform|corridor|elevator|bus_stop|raceway|services|rest_area|abandoned|razed)$"]["footway"!~"^(sidewalk|crossing|traffic_island)$"]["area"!="yes"]';

/**
 * The street or path nearest to a point. Named streets win over unnamed paths
 * that are only marginally closer (separately mapped walkways, steps).
 */
export const findNearestStreet = async (lat: number, lng: number) => {
    const data = await getOverpassData(
        `[out:json][timeout:30];way(around:100,${lat},${lng})${STREET_FILTER};out geom;`,
        t("loading.street"),
    );
    const point = turf.point([lng, lat]);
    const candidates = (data.elements ?? [])
        .filter((element: any) => element.geometry?.length >= 2)
        .map((element: any) => {
            const line = turf.lineString(
                element.geometry.map((p: any) => [p.lon, p.lat]),
            );
            return {
                id: element.id as number,
                name: (element.tags?.name as string | undefined) ?? null,
                line,
                distance: turf.pointToLineDistance(point, line, {
                    units: "meters",
                }),
            };
        })
        .sort((a: any, b: any) => a.distance - b.distance);

    if (candidates.length === 0) return null;
    const nearest = candidates[0];
    const nearestNamed = candidates.find((c: any) => c.name);
    if (
        !nearest.name &&
        nearestNamed &&
        nearestNamed.distance < nearest.distance + 15
    ) {
        return nearestNamed;
    }
    return nearest;
};

/** All parts of a named street inside the game area, as lines. */
export const findStreetLines = async (name: string) => {
    const escaped = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const data = await findPlacesInZone(
        `["highway"]["name"="${escaped}"]`,
        t("loading.named", { name }),
        "way",
        "geom",
    );
    return toLineStrings(data.elements ?? []);
};

/**
 * Named bodies of water in the game area (lakes, ponds, rivers, canals), as
 * OSM elements. Pools, fountains and underground rivers are excluded.
 */
const findNamedWaterElements = async (): Promise<any[]> => {
    const bboxValue = gameAreaBbox();
    const data = await findPlacesInZone(
        '["natural"="water"]["name"]["water"!~"^(pool|swimming_pool|wastewater|basin|fountain|reflecting_pool)$"]["amenity"!="fountain"]',
        t("loading.water"),
        "wr",
        bboxValue ? `geom(${bboxValue})` : "geom",
        ['["waterway"~"^(river|canal)$"]["name"]'],
        60,
    );
    const elements = (data.elements ?? []).filter(
        (element: any) =>
            !/brunnen/i.test(element.tags?.name ?? "") &&
            // Rivers count where they can be seen, not where they run
            // underground (the Wien under Karlsplatz). Their relations also
            // hold the underground parts, so only their ways count.
            !(
                element.tags?.waterway &&
                (element.type === "relation" ||
                    (element.tags.tunnel && element.tags.tunnel !== "no") ||
                    element.tags.covered === "yes")
            ),
    );
    return elements;
};

/** Named bodies of water as shore and centre lines. */
export const findNamedWaterLines = async () =>
    toLineStrings(await findNamedWaterElements());

/**
 * Named lakes, ponds, rivers and canals as areas (rivers where OSM has
 * their banks): whoever is on them is 0 m away from them.
 */
export const findNamedWaterAreas = memoizeAsync(
    async (): Promise<Feature<Polygon | MultiPolygon>[]> =>
        osmtogeojson({
            elements: (await findNamedWaterElements()).filter(
                (element: any) => element.tags?.natural === "water",
            ),
        }).features.filter(
            (feature): feature is Feature<Polygon | MultiPolygon> =>
                (feature.geometry?.type === "Polygon" ||
                    feature.geometry?.type === "MultiPolygon") &&
                turf.area(feature) > 0,
        ),
    () => JSON.stringify([gameAreaBbox(), polyGeoJSON.get() !== null]),
);

export interface TransitLine {
    /** What players see, e.g. "U4" or "S45". */
    ref: string;
    route: string;
    /** The line's colour from OSM, e.g. "#319F49". */
    colour?: string;
    /** Where it runs, e.g. "Hütteldorf" and "Heiligenstadt" (OSM names). */
    from?: string;
    to?: string;
    /**
     * Where its ends are on the map: the end stations, or the last stops in
     * the area where it runs on beyond it (the S-Bahn to Mödling).
     */
    ends?: { name: string; at: Position; beyond: boolean }[];
    /** Its tracks in the game area, each once (both directions share them). */
    lines: Feature<LineString, { name?: string }>[];
}

/**
 * The first and last stop of a route on the map. Stops outside the area
 * have no geometry: then the line runs on beyond the stop on the map.
 */
const routeEnds = (members: any[], from: string, to: string) => {
    const stops = members.filter(
        (member) => member.type === "node" && /^stop/.test(member.role ?? ""),
    );
    const onMap = stops.filter((stop) => typeof stop.lat === "number");
    if (onMap.length < 2) return undefined;
    const first = onMap[0];
    const last = onMap[onMap.length - 1];
    return [
        { name: from, at: [first.lon, first.lat], beyond: first !== stops[0] },
        {
            name: to,
            at: [last.lon, last.lat],
            beyond: last !== stops[stops.length - 1],
        },
    ];
};

/** Route relations with their tracks as lines, by line. */
const transitLinesFrom = (data: any): TransitLine[] => {
    const lines = new Map<string, TransitLine>();
    const wayIds = new Set<string>();
    // The ends of the longest route of each line, not of a short run (U2
    // Karlsplatz to Aspernstraße)
    const longest = new Map<string, number>();
    for (const element of data.elements ?? []) {
        if (element.type !== "relation") continue;
        const tags = element.tags ?? {};
        const line: TransitLine = lines.get(tags.ref) ?? {
            ref: tags.ref,
            route: tags.route,
            colour: tags.colour,
            lines: [],
        };
        line.colour ??= tags.colour;
        const size = element.members?.length ?? 0;
        if (tags.from && tags.to && size > (longest.get(tags.ref) ?? -1)) {
            longest.set(tags.ref, size);
            line.from = tags.from;
            line.to = tags.to;
            line.ends = routeEnds(element.members ?? [], tags.from, tags.to);
        }
        lines.set(tags.ref, line);
        // The tracks, not the platforms; ways outside the area have no geometry
        const tracks = (element.members ?? []).filter(
            (member: any) =>
                member.type === "way" &&
                !member.role &&
                member.geometry &&
                !wayIds.has(`${tags.ref}:${member.ref}`),
        );
        for (const track of tracks) wayIds.add(`${tags.ref}:${track.ref}`);
        line.lines.push(...toLineStrings(tracks));
    }

    return [...lines.values()]
        .filter((line) => line.lines.length > 0)
        .sort(
            (a, b) =>
                LINE_ORDER.indexOf(a.route) - LINE_ORDER.indexOf(b.route) ||
                a.ref.localeCompare(b.ref, undefined, { numeric: true }),
        );
};

/**
 * The U-Bahn and S-Bahn lines of the game area with their colours, clipped
 * to it. Regional and long-distance trains (REX, Railjet) are left out.
 */
export const findTransitLines = async (): Promise<TransitLine[]> => {
    const bboxValue = gameAreaBbox();
    // Without a game area this would ask for every line in the world
    if (!bboxValue) return [];
    const data = await getOverpassData(
        `[out:json][timeout:60];rel["type"="route"]["route"~"^(subway|train)$"]["ref"~"^[US][0-9]+$"](${bboxValue});out geom(${bboxValue});`,
        t("loading.transitLines"),
        CacheType.ZONE_CACHE,
    );
    return transitLinesFrom(data);
};

/**
 * The tram lines of the game area ("1" to "71", "D", "O"), clipped to it.
 * Sightseeing trams have other names. All in one colour: the U-Bahn has the
 * colours.
 */
export const findTramLines = async (): Promise<TransitLine[]> => {
    const bboxValue = gameAreaBbox();
    if (!bboxValue) return [];
    const data = await getOverpassData(
        `[out:json][timeout:60];rel["type"="route"]["route"="tram"]["ref"~"^([0-9]+|[A-Z])$"](${bboxValue});out geom(${bboxValue});`,
        t("loading.tramLines"),
        CacheType.ZONE_CACHE,
    );
    return transitLinesFrom(data).map((line) => ({
        ...line,
        colour: undefined,
    }));
};

/**
 * Islands in the game area that are their own landmass. Islands inside lakes
 * or oxbows don't count (rule: a landmass entirely surrounded by the other
 * landmass is a match), nor do tiny islets.
 */
export const findLandmassIslands = async (): Promise<
    Feature<Polygon | MultiPolygon>[]
> => {
    const data = await findPlacesInZone(
        '["place"~"^(island|islet)$"]',
        t("loading.islands"),
        "wr",
        "geom",
    );
    const islands = osmtogeojson(data).features.filter(
        (feature): feature is Feature<Polygon | MultiPolygon> =>
            !!feature.geometry &&
            (feature.geometry.type === "Polygon" ||
                feature.geometry.type === "MultiPolygon") &&
            turf.area(feature) >= 50_000,
    );
    if (islands.length === 0) return [];

    const wayIds = islands
        .map((feature) => String(feature.id ?? ""))
        .filter((id) => id.startsWith("way/"))
        .map((id) => id.split("/")[1]);
    if (wayIds.length === 0) return islands;

    const lakes = await getOverpassData(
        `[out:json][timeout:30];way(id:${wayIds.join(",")})->.i;rel(bw.i)["natural"="water"]["water"!~"^(river|canal|stream)$"];out body;`,
        t("loading.checkIslands"),
    );
    const enclosed = new Set<string>();
    for (const lake of lakes.elements ?? []) {
        for (const member of lake.members ?? []) {
            if (member.type === "way") enclosed.add(`way/${member.ref}`);
        }
    }
    return islands.filter((feature) => !enclosed.has(String(feature.id)));
};

export const findPlacesInZone = async (
    filter: string,
    loadingText?: string,
    searchType:
        | "node"
        | "way"
        | "relation"
        | "nwr"
        | "nw"
        | "wr"
        | "nr"
        | "area" = "nwr",
    /** "center", "geom", or "geom(s,w,n,e)" to clip geometry to a bbox. */
    outType: string = "center",
    alternatives: string[] = [],
    timeoutDuration: number = 0,
) => {
    let query = "";
    const $polyGeoJSON = polyGeoJSON.get();
    if ($polyGeoJSON) {
        query = `
[out:json]${timeoutDuration != 0 ? `[timeout:${timeoutDuration}]` : ""};
(
${searchType}${filter}(poly:"${turf
            .getCoords($polyGeoJSON.features)
            .flatMap((polygon) => polygon.geometry.coordinates)
            .flat()
            .map((coord) => [coord[1], coord[0]].join(" "))
            .join(" ")}");
${
    alternatives.length > 0
        ? alternatives
              .map(
                  (alternative) =>
                      `${searchType}${alternative}(poly:"${turf
                          .getCoords($polyGeoJSON.features)
                          .flatMap((polygon) => polygon.geometry.coordinates)
                          .flat()
                          .map((coord) => [coord[1], coord[0]].join(" "))
                          .join(" ")}");`,
              )
              .join("\n")
        : ""
}
);
out ${outType};
`;
    } else {
        const primaryLocation = mapGeoLocation.get();
        const additionalLocations = additionalMapGeoLocations
            .get()
            .filter((entry) => entry.added)
            .map((entry) => entry.location);
        const allLocations = [primaryLocation, ...additionalLocations];
        const relationToAreaBlocks = allLocations
            .map((loc, idx) => {
                const regionVar = `.region${idx}`;
                return `relation(${loc.properties.osm_id});map_to_area->${regionVar};`;
            })
            .join("\n");
        const searchBlocks = allLocations
            .map((_, idx) => {
                const regionVar = `area.region${idx}`;
                const altQueries =
                    alternatives.length > 0
                        ? alternatives
                              .map(
                                  (alt) => `${searchType}${alt}(${regionVar});`,
                              )
                              .join("\n")
                        : "";
                return `
            ${searchType}${filter}(${regionVar});
            ${altQueries}
          `;
            })
            .join("\n");
        query = `
        [out:json]${timeoutDuration !== 0 ? `[timeout:${timeoutDuration}]` : ""};
        ${relationToAreaBlocks}
        (
        ${searchBlocks}
        );
        out ${outType};
        `;
    }
    const data = await getOverpassData(
        query,
        loadingText,
        CacheType.ZONE_CACHE,
    );
    const subtractedEntries = additionalMapGeoLocations
        .get()
        .filter((e) => !e.added);
    const subtractedPolygons = subtractedEntries.map((entry) => entry.location);
    if (subtractedPolygons.length > 0 && data && data.elements) {
        const turfPolys = await Promise.all(
            subtractedPolygons.map(
                async (location) =>
                    turf.combine(
                        await determineGeoJSON(
                            location.properties.osm_id.toString(),
                            location.properties.osm_type,
                        ),
                    ).features[0],
            ),
        );
        data.elements = data.elements.filter((el: any) => {
            const lon = el.center ? el.center.lon : el.lon;
            const lat = el.center ? el.center.lat : el.lat;
            if (typeof lon !== "number" || typeof lat !== "number")
                return false;
            const pt = turf.point([lon, lat]);
            return !turfPolys.some((poly) =>
                turf.booleanPointInPolygon(pt, poly as any),
            );
        });
    }
    return data;
};

/**
 * Every place of a kind in the game area that counts, e.g. all named parks.
 * The query takes all of them, so data saved before the rule stays usable.
 */
export const findPlacesOfKind = async (location: APILocations) => {
    const data = await findPlacesInZone(
        `[${LOCATION_FIRST_TAG[location]}=${location}]`,
        t("loading.places", { what: prettifyLocation(location) }),
        "nwr",
        "center",
        [],
        60,
    );
    return {
        ...data,
        elements: (data.elements ?? []).filter((element: any) =>
            placeCounts(location, element.tags),
        ),
    };
};

export const findHighSpeedLines = () =>
    findPlacesInZone("[highspeed=yes]", t("loading.highSpeed"), "nwr", "geom");

export const findPlacesSpecificInZone = async (
    location: `${QuestionSpecificLocation}`,
) => {
    const locations = (
        await findPlacesInZone(
            location,
            t("loading.places", {
                what: t(
                    location === '["brand:wikidata"="Q38076"]'
                        ? "places.mcdonalds"
                        : "places.seven11",
                ),
            }),
        )
    ).elements;
    return turf.featureCollection(
        locations.map((x: any) =>
            turf.point([
                x.center ? x.center.lon : x.lon,
                x.center ? x.center.lat : x.lat,
            ]),
        ),
    );
};

export const nearestToQuestion = async (
    question: HomeGameMatchingQuestions | HomeGameMeasuringQuestions,
) => {
    let radius = 30;
    let instances: any = { features: [] };
    while (instances.features.length === 0) {
        instances = await findTentacleLocations(
            {
                lat: question.lat,
                lng: question.lng,
                radius: radius,
                unit: "miles",
                locationType: question.type,
            },
            t("loading.matchingPlaces"),
        );
        radius += 30;
    }
    const questionPoint = turf.point([question.lng, question.lat]);
    return turf.nearestPoint(questionPoint, instances as any);
};

export const determineMapBoundaries = async () => {
    const mapGeoDatum = await Promise.all(
        [
            {
                location: mapGeoLocation.get(),
                added: true,
                base: true,
            },
            ...additionalMapGeoLocations.get(),
        ].map(async (location) => ({
            added: location.added,
            data: await determineGeoJSON(
                location.location.properties.osm_id.toString(),
                location.location.properties.osm_type,
            ),
        })),
    );

    let mapGeoData = turf.featureCollection([
        safeUnion(
            turf.featureCollection(
                mapGeoDatum
                    .filter((x) => x.added)
                    .flatMap((x) => x.data.features),
            ) as any,
        ),
    ]);

    const differences = mapGeoDatum.filter((x) => !x.added).map((x) => x.data);

    if (differences.length > 0) {
        mapGeoData = turf.featureCollection([
            turf.difference(
                turf.featureCollection([
                    mapGeoData.features[0],
                    ...differences.flatMap((x) => x.features),
                ]),
            )!,
        ]);
    }

    if (turf.coordAll(mapGeoData).length > 10000) {
        turf.simplify(mapGeoData, {
            tolerance: 0.0005,
            highQuality: true,
            mutate: true,
        });
    }

    return turf.combine(mapGeoData) as FeatureCollection<MultiPolygon>;
};
