import * as turf from "@turf/turf";
import type { Feature, MultiPolygon } from "geojson";

import { t } from "@/lib/i18n";

import { cacheFetch } from "./cache";
import { CacheType } from "./types";

/**
 * Elevation from the free, keyless Terrarium tiles (AWS Open Data, CORS
 * enabled). At zoom 12 one pixel is ~25 m in Central Europe, which is plenty
 * for "closer to or further from sea level".
 */
const ZOOM = 12;
const TILE_SIZE = 256;
const tileUrl = (x: number, y: number) =>
    `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${ZOOM}/${x}/${y}.png`;

const tiles = new Map<string, Promise<Uint8ClampedArray | null>>();

const decodePng = async (blob: Blob) => {
    const bitmap = await createImageBitmap(blob);
    const canvas =
        typeof OffscreenCanvas !== "undefined"
            ? new OffscreenCanvas(TILE_SIZE, TILE_SIZE)
            : Object.assign(document.createElement("canvas"), {
                  width: TILE_SIZE,
                  height: TILE_SIZE,
              });
    const context = canvas.getContext("2d") as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null;
    if (!context) return null;
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, TILE_SIZE, TILE_SIZE).data;
};

const loadTile = (x: number, y: number) => {
    const key = `${x}/${y}`;
    if (!tiles.has(key)) {
        const tile = (async () => {
            try {
                const response = await cacheFetch(
                    tileUrl(x, y),
                    t("loading.elevation"),
                    CacheType.PERMANENT_CACHE,
                );
                if (!response.ok) return null;
                return await decodePng(await response.blob());
            } catch {
                return null;
            }
        })();
        tiles.set(key, tile);
        // Try a missing tile again next time
        tile.then((data) => data === null && tiles.delete(key));
    }
    return tiles.get(key)!;
};

const toTile = (lat: number, lng: number) => {
    const n = 2 ** ZOOM;
    const latRad = (lat * Math.PI) / 180;
    const xf = ((lng + 180) / 360) * n;
    const yf =
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
            2) *
        n;
    const x = Math.floor(xf);
    const y = Math.floor(yf);
    return {
        x,
        y,
        px: Math.min(TILE_SIZE - 1, Math.floor((xf - x) * TILE_SIZE)),
        py: Math.min(TILE_SIZE - 1, Math.floor((yf - y) * TILE_SIZE)),
    };
};

const readElevation = (data: Uint8ClampedArray, px: number, py: number) => {
    const i = (py * TILE_SIZE + px) * 4;
    return data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
};

/** Loads the elevation of a whole bbox ahead of time; false if some is missing. */
export const preloadElevation = async (
    bbox: [number, number, number, number],
) => {
    const [west, south, east, north] = bbox;
    const from = toTile(north, west);
    const to = toTile(south, east);
    const loads: Promise<Uint8ClampedArray | null>[] = [];
    for (let x = from.x; x <= to.x; x++) {
        for (let y = from.y; y <= to.y; y++) {
            loads.push(loadTile(x, y));
        }
    }
    const loaded = await Promise.all(loads);
    return loaded.every((data) => data !== null);
};

/** Elevation in meters above sea level, or null if the tile can't be loaded. */
export const elevationAt = async (lat: number, lng: number) => {
    const { x, y, px, py } = toTile(lat, lng);
    const data = await loadTile(x, y);
    return data ? readElevation(data, px, py) : null;
};

/**
 * The part of the bbox that lies lower than `elevation`, i.e. closer to sea
 * level. Returns null if elevation data is unavailable.
 */
/**
 * The map reads the ground on a grid (100 m or coarser), the hider's answer
 * at the exact spot. So the map greys only what is surely higher or lower
 * than the seekers, by this much (like the rivers left light on landmass).
 */
export const SEA_LEVEL_MARGIN_METERS = 3;

/**
 * The elevation the map splits the game area at: below it the hider can be
 * when lower than the seekers, above it when higher.
 */
export const seaLevelLimit = (seekers: number, hiderLower: boolean) =>
    seekers + (hiderLower ? SEA_LEVEL_MARGIN_METERS : -SEA_LEVEL_MARGIN_METERS);

export const regionLowerThan = async (
    bbox: [number, number, number, number],
    elevation: number,
): Promise<Feature<MultiPolygon> | null> => {
    const [west, south, east, north] = bbox;
    const widthKm = turf.distance([west, south], [east, south]);
    const heightKm = turf.distance([west, south], [west, north]);
    // ~40,000 grid points at most, but never coarser than 100 m.
    const cellKm = Math.max(0.1, Math.sqrt((widthKm * heightKm) / 40_000));

    const grid = turf.pointGrid(bbox, cellKm, { units: "kilometers" });
    const located = grid.features.map((point) => {
        const [lng, lat] = point.geometry.coordinates;
        return toTile(lat, lng);
    });

    const keys = [...new Set(located.map(({ x, y }) => `${x}/${y}`))];
    const loaded = new Map<string, Uint8ClampedArray | null>();
    await Promise.all(
        keys.map(async (key) => {
            const [x, y] = key.split("/").map(Number);
            loaded.set(key, await loadTile(x, y));
        }),
    );
    if ([...loaded.values()].some((data) => data === null)) return null;

    grid.features.forEach((point, index) => {
        const { x, y, px, py } = located[index];
        point.properties = {
            elevation: readElevation(loaded.get(`${x}/${y}`)!, px, py),
        };
    });

    const bands = turf.isobands(grid, [-1000, elevation], {
        zProperty: "elevation",
    });
    return (bands.features[0] as Feature<MultiPolygon>) ?? null;
};
