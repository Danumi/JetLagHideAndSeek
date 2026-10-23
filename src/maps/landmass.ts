import * as turf from "@turf/turf";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";

import {
    additionalMapGeoLocations,
    mapGeoLocation,
    polyGeoJSON,
    VIENNA,
} from "@/lib/context";
import { memoizeAsync } from "@/lib/utils";
import {
    findAdminAreas,
    findLandmassIslands,
    findNamedWaterAreas,
} from "@/maps/api";
import { safeUnion } from "@/maps/geo-utils";

/*
 * Landmasses: land in one piece, not cut by a waterway (rule book). In
 * Vienna, the Donau, the Neue Donau and the Donaukanal make four:
 * Leopoldstadt and Brigittenau between the Donaukanal and the Donau, the
 * Donauinsel, Floridsdorf and Donaustadt north of the Neue Donau, and the
 * rest of Vienna. They only meet outside the city, and outside the game
 * area there is nothing. Islands in lakes belong to the land around them.
 * Elsewhere: the islands from OpenStreetMap, and the mainland.
 *
 * House rule: on a bridge or on the water, the nearer shore counts.
 */

type Area = Feature<Polygon | MultiPolygon>;

/** The waterways between Vienna's landmasses, as named in OSM. */
export const VIENNA_WATERWAYS = ["Donau", "Neue Donau", "Donaukanal"];

/** Vienna's landmasses besides islands, by their districts' OSM names. */
const VIENNA_DISTRICT_LANDMASSES = {
    leopoldstadt: ["Leopoldstadt", "Brigittenau"],
    transdanubia: ["Floridsdorf", "Donaustadt"],
};

export type Landmass = {
    /**
     * "leopoldstadt", "transdanubia" and "rest" in Vienna, "mainland"
     * elsewhere, or an island's OSM id like "way/183963191".
     */
    id: string;
    /** An island's name from OpenStreetMap, like "Donauinsel". */
    name?: string;
    /**
     * Where it is, in Vienna with the water up to its district border.
     * None: everything the other landmasses leave.
     */
    area?: Area;
    /**
     * In Vienna, where an island is with the land along its shore that
     * counts as the island (see `ISLAND_GAP_METERS`).
     */
    shore?: Area;
};

export type Landmasses = {
    landmasses: Landmass[];
    /** The waterways between them; on them, the nearer shore counts. */
    waterways: Area[];
};

/** Whether the game is the Vienna game: its districts are the landmasses. */
const isViennaGame = () =>
    mapGeoLocation.get().properties.osm_id === VIENNA.properties.osm_id &&
    polyGeoJSON.get() === null &&
    !additionalMapGeoLocations.get().some((entry) => entry.added);

const islandLandmass = (island: Area): Landmass => ({
    id: String(island.id ?? island.properties?.name ?? "island"),
    name: island.properties?.name,
    area: island,
});

const without = (area: Area | null, holes: Area[]): Area | null => {
    if (!area || holes.length === 0) return area;
    return turf.difference(
        turf.featureCollection([
            area,
            safeUnion(turf.featureCollection(holes)),
        ]),
    ) as Area | null;
};

/**
 * Islands are narrower in OSM than their river banks in places: land this
 * close to an island, and not in the water, is the island. The rivers
 * around Vienna's island are much wider.
 */
const ISLAND_GAP_METERS = 50;

/** An island with the land along its shore that counts as the island. */
const withShore = (island: Area): Area =>
    (turf.buffer(island, ISLAND_GAP_METERS, { units: "meters" }) as
        | Area
        | undefined) ?? island;

/** Vienna's landmasses from its islands, districts and named waters. */
export const viennaLandmassesFrom = (
    islands: Area[],
    districts: Area[],
    waters: Area[],
): Landmasses | null => {
    const landmasses: Landmass[] = islands.map((island) => ({
        ...islandLandmass(island),
        shore: withShore(island),
    }));
    const shores = landmasses.map((island) => island.shore!);
    for (const [id, names] of Object.entries(VIENNA_DISTRICT_LANDMASSES)) {
        const parts = districts.filter((district) =>
            names.includes(district.properties?.name),
        );
        // Without its districts the app can't tell the landmasses apart
        if (parts.length !== names.length) return null;
        const area = without(
            safeUnion(turf.featureCollection(parts)) as Area,
            shores,
        );
        if (area) landmasses.push({ id, area });
    }
    landmasses.push({ id: "rest" });
    return {
        landmasses,
        waterways: waters.filter((water) =>
            VIENNA_WATERWAYS.includes(water.properties?.name ?? ""),
        ),
    };
};

const viennaLandmasses = async () =>
    viennaLandmassesFrom(
        ...(await Promise.all([
            findLandmassIslands(),
            findAdminAreas(9),
            findNamedWaterAreas(),
        ])),
    );

/** The landmasses of the game area; null when it has only one. */
export const findLandmasses = memoizeAsync(
    async (): Promise<Landmasses | null> => {
        if (isViennaGame()) {
            const vienna = await viennaLandmasses();
            if (vienna) return vienna;
        }
        const islands = await findLandmassIslands();
        if (islands.length === 0) return null;
        return {
            landmasses: [...islands.map(islandLandmass), { id: "mainland" }],
            waterways: [],
        };
    },
    () =>
        JSON.stringify([
            mapGeoLocation.get().properties.osm_id,
            polyGeoJSON.get() !== null,
            additionalMapGeoLocations.get().filter((entry) => entry.added)
                .length,
        ]),
);

/**
 * The landmass of a point on land, islands with the land along their shore;
 * the rest, if no other one has it.
 */
const landmassOnLand = (all: Landmasses, point: Feature<any>) =>
    all.landmasses.find((landmass) => {
        const area = landmass.shore ?? landmass.area;
        return area && turf.booleanPointInPolygon(point, area);
    }) ?? all.landmasses.find((landmass) => !landmass.area)!;

/** How far a point is from an area, in meters; 0 inside. */
const metersTo = (point: Feature<any>, area: Area) =>
    turf.booleanPointInPolygon(point, area)
        ? 0
        : Math.min(
              ...turf
                  .flatten(turf.polygonToLine(area) as any)
                  .features.map((line: any) =>
                      turf.pointToLineDistance(point, line, {
                          units: "meters",
                      }),
                  ),
          );

/** The nearest point on the shores of some waterways. */
const nearestShore = (point: Feature<any>, waterways: Area[]) => {
    let best: { at: Position; meters: number } | null = null;
    for (const water of waterways) {
        for (const line of turf.flatten(turf.polygonToLine(water) as any)
            .features) {
            const snapped = turf.nearestPointOnLine(line as any, point, {
                units: "meters",
            });
            if (!best || snapped.properties.dist < best.meters) {
                best = {
                    at: snapped.geometry.coordinates,
                    meters: snapped.properties.dist,
                };
            }
        }
    }
    return best;
};

/**
 * Who is this close to an island counts as on it when it is the nearest
 * shore (OSM draws islands and river banks with tiny gaps).
 */
const ISLAND_SHORE_METERS = 5;

/**
 * District borders run along a river bank, not exactly on it: within this
 * much of a waterway, the land behind decides.
 */
const NEAR_SHORE_METERS = 30;

const onWater = (all: Landmasses, point: Feature<any>) =>
    all.waterways.some((area) => turf.booleanPointInPolygon(point, area));

/**
 * The landmass a point is on. On a bridge or on the water between two
 * landmasses: the one of the nearer shore (house rule).
 */
export const landmassOf = (
    all: Landmasses,
    at: { lat: number; lng: number },
): Landmass => {
    const point = turf.point([at.lng, at.lat]);
    const island = all.landmasses.find(
        (landmass) =>
            landmass.name !== undefined &&
            landmass.area &&
            turf.booleanPointInPolygon(point, landmass.area),
    );
    if (island) return island;
    if (all.waterways.length === 0) return landmassOnLand(all, point);

    const inWater = onWater(all, point);
    if (!inWater) {
        const landmass = landmassOnLand(all, point);
        if (landmass.name !== undefined) return landmass;
    }
    const shore = nearestShore(point, all.waterways);
    if (!shore || (!inWater && shore.meters > NEAR_SHORE_METERS)) {
        return landmassOnLand(all, point);
    }

    if (inWater) {
        // An island whose shore is the nearest one
        const nearIsland = all.landmasses.find(
            (landmass) =>
                landmass.name !== undefined &&
                landmass.area &&
                metersTo(point, landmass.area) <=
                    shore.meters + ISLAND_SHORE_METERS,
        );
        if (nearIsland) return nearIsland;
    }

    // The land behind the shore: beyond it seen from the water, further
    // away from the water seen from the land
    if (shore.meters > 0.5) {
        const bearing = inWater
            ? turf.bearing(point, shore.at)
            : turf.bearing(shore.at, point);
        // 5 m last: a district border may run a few meters off the bank
        for (const meters of [15, 40, 100, 5]) {
            const land = turf.destination(
                shore.at,
                (inWater ? 0 : shore.meters) + meters,
                bearing,
                { units: "meters" },
            );
            if (!onWater(all, land)) return landmassOnLand(all, land);
        }
        // A tiny piece of land, like a pier: the shore itself decides
        return landmassOnLand(all, turf.point(shore.at));
    }
    return landmassOnLand(all, point);
};

/**
 * Where a landmass is, for the map: its area, islands with the land along
 * their shore, or for the rest everything within `everything` the others
 * leave.
 */
export const landmassArea = (
    all: Landmasses,
    landmass: Landmass,
    everything: Area,
): Area | null =>
    landmass.shore ??
    landmass.area ??
    without(
        everything,
        all.landmasses.flatMap((other) => {
            const area = other.shore ?? other.area;
            return area ? [area] : [];
        }),
    );
