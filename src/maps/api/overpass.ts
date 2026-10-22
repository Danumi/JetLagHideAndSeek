import * as turf from "@turf/turf";
import type {
    Feature,
    FeatureCollection,
    LineString,
    MultiPolygon,
    Polygon,
} from "geojson";
import _ from "lodash";
import osmtogeojson from "osmtogeojson";
import { toast } from "react-toastify";

import {
    additionalMapGeoLocations,
    mapGeoJSON,
    mapGeoLocation,
    overpassCustomHost,
    overpassHost,
    polyGeoJSON,
} from "@/lib/context";
import { safeUnion } from "@/maps/geo-utils";

import { cacheFetch, determineCache } from "./cache";
import { LOCATION_FIRST_TAG, OVERPASS_HOSTS } from "./constants";
import type {
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

const findCachedResponse = async (urls: string[], cacheType: CacheType) => {
    try {
        const cache = await determineCache(cacheType);
        for (const url of urls) {
            const cached = await cache.match(url);
            if (cached?.ok) return cached.clone();
        }
    } catch {
        // Cache API unavailable; just fetch.
    }
    return null;
};

const firstOkResponse = (
    urls: string[],
    cacheType: CacheType,
): Promise<{ response: Response | null; url: string | null }> =>
    new Promise((resolve) => {
        let next = 0;
        let running = 0;
        let settled = false;
        let lastResponse: Response | null = null;
        let hedgeTimer: ReturnType<typeof setTimeout> | undefined;

        const finish = (response: Response | null, url: string | null) => {
            if (settled) return;
            settled = true;
            clearTimeout(hedgeTimer);
            resolve({ response, url });
        };

        const launch = () => {
            if (settled || next >= urls.length) return;
            const url = urls[next++];
            running++;
            clearTimeout(hedgeTimer);
            if (next < urls.length) {
                hedgeTimer = setTimeout(launch, OVERPASS_HEDGE_MS);
            }
            cacheFetch(url, undefined, cacheType)
                .then((response) => {
                    if (response.ok) {
                        finish(response, url);
                    } else {
                        lastResponse = response;
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

        launch();
    });

export const getOverpassData = async (
    query: string,
    loadingText?: string,
    cacheType: CacheType = CacheType.CACHE,
) => {
    const encodedQuery = encodeURIComponent(query);
    const allHostUrls: string[] = Object.values(OVERPASS_HOSTS);
    const selectedHost = overpassHost.get();
    const customUrl = overpassCustomHost.get();

    const primaryBaseUrl =
        selectedHost === "custom"
            ? customUrl || allHostUrls[0]
            : selectedHost || allHostUrls[0];
    const urls = [
        primaryBaseUrl,
        ...allHostUrls.filter((h) => h !== primaryBaseUrl),
    ].map((base) => `${base}?data=${encodedQuery}`);

    const cached = await findCachedResponse(urls, cacheType);
    if (cached) return await cached.json();

    const request = firstOkResponse(urls, cacheType);
    const { response, url } = await (loadingText
        ? toast.promise(request, { pending: loadingText })
        : request);

    if (!response || !response.ok) {
        toast.error(
            `Could not load data from Overpass${
                response ? `: ${response.status} ${response.statusText}` : ""
            }`,
            { toastId: "overpass-error" },
        );
        return { elements: [] };
    }

    if (url !== urls[0]) {
        try {
            const cache = await determineCache(cacheType);
            await cache.put(urls[0], response.clone());
        } catch {
            // Caching is best-effort.
        }
    }

    return await response.json();
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
        "Loading map data...",
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
    text: string = "Determining tentacle locations...",
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
        if (!element.tags["name"] && !element.tags["name:en"]) return;
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

export const findAdminBoundary = async (
    latitude: number,
    longitude: number,
    adminLevel: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
) => {
    const query = `
[out:json];
is_in(${latitude}, ${longitude})->.a;
rel(pivot.a)["admin_level"="${adminLevel}"];
out geom;
    `;
    const data = await getOverpassData(query, "Determining matching zone...");
    const geo = osmtogeojson(data);
    return geo.features?.[0];
};

export const fetchCoastline = async () => {
    const response = await cacheFetch(
        import.meta.env.BASE_URL + "/coastline50.geojson",
        "Fetching coastline data...",
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
    '["type"="route"]["route"~"^(subway|train|light_rail|tram|monorail)$"]';
const LINE_ORDER = ["subway", "light_rail", "train", "monorail", "tram"];

export interface StationLine {
    /** Stable identifier, e.g. "subway:U4". */
    key: string;
    /** What players see, e.g. "U4". */
    label: string;
    route: string;
    /** OSM node ids of the stations this line stops at (inside the game area). */
    stationIds: number[];
}

/**
 * All lines that stop at a station, each with the stations it stops at.
 *
 * A line counts as stopping at a station when the station is in the line's
 * route relation, shares a stop area with one of its stops or platforms, or
 * lies within 150 m of one (stations that are not linked in OSM, and
 * interchanges like U-Bahn and S-Bahn Praterstern).
 */
export const findStationLines = async (
    node: string,
): Promise<StationLine[]> => {
    const nodeId = node.split("/")[1];
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

    const query = `
[out:json][timeout:60];
node(${nodeId})->.s;
rel(bn.s)["public_transport"="stop_area"]->.sa;
(node(r.sa);way(r.sa);)->.sam;
(node(around.s:150)["public_transport"~"^(stop_position|platform)$"];way(around.s:150)["public_transport"="platform"];)->.near;
(rel(bn.s)${LINE_ROUTE_FILTER};rel(bn.sam)${LINE_ROUTE_FILTER};rel(bw.sam)${LINE_ROUTE_FILTER};rel(bn.near)${LINE_ROUTE_FILTER};rel(bw.near)${LINE_ROUTE_FILTER};)->.routes;
foreach.routes->.rt(
.rt out tags;
(${members})->.rm;
(rel(bn.rm)["public_transport"="stop_area"];rel(bw.rm)["public_transport"="stop_area"];)->.rsa;
(node(r.rsa)${STATION_FILTER};node.rm${STATION_FILTER};node(around.rm:150)${STATION_FILTER};);
out ids;
);`;

    const data = await getOverpassData(
        query,
        "Finding train lines...",
        CacheType.ZONE_CACHE,
    );

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

    return [...lines.values()]
        .map((line) => ({ ...line, stationIds: _.uniq(line.stationIds) }))
        .sort(
            (a, b) =>
                LINE_ORDER.indexOf(a.route) - LINE_ORDER.indexOf(b.route) ||
                a.label.localeCompare(b.label, undefined, { numeric: true }),
        );
};

/**
 * Station node ids that count as being on the seekers' line.
 *
 * Per the rules the seekers name the one line they are riding (`lineKey`).
 * Without a chosen line only certain eliminations are made: "same" keeps
 * every station on any line through the seekers' station, "different" only
 * removes stations served by all of those lines.
 */
export const trainLineNodeFinder = async (
    node: string,
    lineKey?: string,
    same = true,
): Promise<number[]> => {
    const lines = await findStationLines(node);
    if (lines.length === 0) return [];

    const chosen = lines.find((line) => line.key === lineKey);
    if (chosen) return chosen.stationIds;

    if (same) return _.uniq(lines.flatMap((line) => line.stationIds));
    return _.intersection(...lines.map((line) => line.stationIds));
};

const toLineStrings = (elements: any[]): Feature<LineString>[] => {
    const geometries: { lat: number; lon: number }[][] = [];
    for (const element of elements) {
        if (element.type === "way" && element.geometry) {
            geometries.push(element.geometry);
        } else if (element.type === "relation" && element.members) {
            for (const member of element.members) {
                if (member.geometry) geometries.push(member.geometry);
            }
        }
    }

    const lines: Feature<LineString>[] = [];
    for (const geometry of geometries) {
        // Clipped geometries contain gaps (null) where the way leaves the bbox.
        let run: [number, number][] = [];
        for (const point of geometry) {
            if (point && typeof point.lon === "number") {
                run.push([point.lon, point.lat]);
            } else {
                if (run.length >= 2) lines.push(turf.lineString(run));
                run = [];
            }
        }
        if (run.length >= 2) lines.push(turf.lineString(run));
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
        "Finding nearest street...",
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
        `Finding ${name}...`,
        "way",
        "geom",
    );
    return toLineStrings(data.elements ?? []);
};

/**
 * Named bodies of water in the game area (lakes, ponds, rivers, canals) as
 * shore/center lines. Pools and fountains are excluded.
 */
export const findNamedWaterLines = async () => {
    const bboxValue = gameAreaBbox();
    const data = await findPlacesInZone(
        '["natural"="water"]["name"]["water"!~"^(pool|swimming_pool|wastewater|basin|fountain|reflecting_pool)$"]["amenity"!="fountain"]',
        "Finding bodies of water...",
        "wr",
        bboxValue ? `geom(${bboxValue})` : "geom",
        ['["waterway"~"^(river|canal)$"]["name"]'],
        60,
    );
    const elements = (data.elements ?? []).filter(
        (element: any) => !/brunnen/i.test(element.tags?.name ?? ""),
    );
    return toLineStrings(elements);
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
        "Finding islands...",
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
        "Checking islands...",
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

export const findPlacesSpecificInZone = async (
    location: `${QuestionSpecificLocation}`,
) => {
    const locations = (
        await findPlacesInZone(
            location,
            `Finding ${
                location === '["brand:wikidata"="Q38076"]'
                    ? "McDonald's"
                    : "7-Elevens"
            }...`,
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
            "Finding matching locations...",
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
