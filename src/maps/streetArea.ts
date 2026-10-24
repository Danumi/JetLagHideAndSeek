import * as turf from "@turf/turf";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";

/*
 * "Street or Path": where a street is the nearest one, worked out the way
 * the hider's phone does it at a single point (`findNearestStreet`): among
 * the streets and paths within 100 m, the nearest; a named street wins over
 * an unnamed path that is at most 15 m nearer. The map samples this on a
 * grid of 8 m around the street, so in a city it's a narrow strip along the
 * street, cut short where cross streets are nearer.
 */

/** findNearestStreet only looks this far. */
export const STREET_SEARCH_METERS = 100;
/** A named street wins over an unnamed path at most this much nearer. */
export const NAMED_STREET_BONUS_METERS = 15;
/** Grid spacing of the samples, also the margin at the strip's edges. */
const CELL_METERS = 8;
/** Segments are looked up in buckets of this size. */
const BUCKET_METERS = 25;

export interface StreetWay {
    /** The OSM way id. */
    id: number;
    name: string | null;
    /** Its points, [lng, lat]. */
    points: Position[];
}

export interface StreetArea {
    /** Where the street may be the nearest one: "same" keeps this. */
    possible: Feature<Polygon | MultiPolygon> | null;
    /** Where it's certainly the nearest one: "different" rules this out. */
    certain: Feature<Polygon | MultiPolygon> | null;
}

type Segment = {
    ax: number;
    ay: number;
    bx: number;
    by: number;
    street: number;
};

const distanceToSegment = (x: number, y: number, s: Segment) => {
    const dx = s.bx - s.ax;
    const dy = s.by - s.ay;
    const length = dx * dx + dy * dy;
    let t = length > 0 ? ((x - s.ax) * dx + (y - s.ay) * dy) / length : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(x - (s.ax + t * dx), y - (s.ay + t * dy));
};

// Cells and buckets as one number each: i and j stay far below the offset
const OFFSET = 100_000;
const cellKey = (i: number, j: number) =>
    (i + OFFSET) * 2 * OFFSET + j + OFFSET;
const cellOf = (key: number) => {
    const j = (key % (2 * OFFSET)) - OFFSET;
    const i = Math.round((key - j - OFFSET) / (2 * OFFSET)) - OFFSET;
    return [i, j];
};

/**
 * Where `target` is the nearest street: all ways with its name, or the one
 * unnamed way. `streets` holds every street and path within 200 m of it.
 */
export const streetArea = (
    target: { id: number; name: string | null },
    streets: StreetWay[],
): StreetArea => {
    const isTarget = (street: StreetWay) =>
        target.name ? street.name === target.name : street.id === target.id;
    const targetPoints = streets.filter(isTarget).flatMap((s) => s.points);
    if (targetPoints.length === 0) return { possible: null, certain: null };

    // Meters on a plane: fine for the few kilometers of a street
    const [lng0, lat0] = turf.getCoord(turf.center(turf.points(targetPoints)));
    const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180);
    const ky = 110_574;
    const toXY = ([lng, lat]: Position) => [
        (lng - lng0) * kx,
        (lat - lat0) * ky,
    ];
    const toLngLat = (x: number, y: number) => [lng0 + x / kx, lat0 + y / ky];

    const segments: Segment[] = [];
    streets.forEach((street, index) => {
        const points = street.points.map(toXY);
        for (let k = 1; k < points.length; k++) {
            segments.push({
                ax: points[k - 1][0],
                ay: points[k - 1][1],
                bx: points[k][0],
                by: points[k][1],
                street: index,
            });
        }
    });

    const buckets = new Map<number, number[]>();
    segments.forEach((s, index) => {
        const i0 = Math.floor(Math.min(s.ax, s.bx) / BUCKET_METERS);
        const i1 = Math.floor(Math.max(s.ax, s.bx) / BUCKET_METERS);
        const j0 = Math.floor(Math.min(s.ay, s.by) / BUCKET_METERS);
        const j1 = Math.floor(Math.max(s.ay, s.by) / BUCKET_METERS);
        for (let i = i0; i <= i1; i++) {
            for (let j = j0; j <= j1; j++) {
                const key = cellKey(i, j);
                const bucket = buckets.get(key);
                if (bucket) bucket.push(index);
                else buckets.set(key, [index]);
            }
        }
    });

    /**
     * The street nearest to a point, as findNearestStreet picks it. Streets
     * further than `reach` can't be it.
     */
    const nearestStreet = (x: number, y: number, reach: number) => {
        const bi = Math.floor(x / BUCKET_METERS);
        const bj = Math.floor(y / BUCKET_METERS);
        let nearest = -1;
        let nearestMeters = Infinity;
        let named = -1;
        let namedMeters = Infinity;
        const look = (i: number, j: number) => {
            for (const index of buckets.get(cellKey(i, j)) ?? []) {
                const s = segments[index];
                const meters = distanceToSegment(x, y, s);
                if (meters > reach) continue;
                if (meters < nearestMeters) {
                    nearestMeters = meters;
                    nearest = s.street;
                }
                if (streets[s.street].name && meters < namedMeters) {
                    namedMeters = meters;
                    named = s.street;
                }
            }
        };
        // Ring by ring around the point's bucket, until no street further
        // out can matter: beyond the nearest one and its 15 m
        for (let ring = 0; ; ring++) {
            const covered = (ring - 1) * BUCKET_METERS;
            const needed = Math.min(
                reach,
                nearestMeters + NAMED_STREET_BONUS_METERS,
            );
            if (covered >= needed) break;
            for (let i = bi - ring; i <= bi + ring; i++) {
                const edge = i === bi - ring || i === bi + ring;
                for (
                    let j = bj - ring;
                    j <= bj + ring;
                    j += edge || ring === 0 ? 1 : 2 * ring
                ) {
                    look(i, j);
                }
            }
        }
        if (nearest < 0) return null;
        if (
            !streets[nearest].name &&
            named >= 0 &&
            namedMeters < nearestMeters + NAMED_STREET_BONUS_METERS
        ) {
            return streets[named];
        }
        return streets[nearest];
    };

    // The cells within reach of the street, with their distance to it
    const toTarget = new Map<number, number>();
    for (const s of segments) {
        if (!isTarget(streets[s.street])) continue;
        const reach = STREET_SEARCH_METERS;
        const i0 = Math.ceil((Math.min(s.ax, s.bx) - reach) / CELL_METERS);
        const i1 = Math.floor((Math.max(s.ax, s.bx) + reach) / CELL_METERS);
        const j0 = Math.ceil((Math.min(s.ay, s.by) - reach) / CELL_METERS);
        const j1 = Math.floor((Math.max(s.ay, s.by) + reach) / CELL_METERS);
        for (let i = i0; i <= i1; i++) {
            for (let j = j0; j <= j1; j++) {
                const meters = distanceToSegment(
                    i * CELL_METERS,
                    j * CELL_METERS,
                    s,
                );
                if (meters > reach) continue;
                const key = cellKey(i, j);
                const known = toTarget.get(key);
                if (known === undefined || meters < known) {
                    toTarget.set(key, meters);
                }
            }
        }
    }
    // Where it's the nearest: only streets at most 15 m further than it
    // can change that
    const nearest = new Set<number>();
    for (const [key, meters] of toTarget) {
        const [i, j] = cellOf(key);
        const street = nearestStreet(
            i * CELL_METERS,
            j * CELL_METERS,
            Math.min(
                STREET_SEARCH_METERS,
                meters + NAMED_STREET_BONUS_METERS + 1,
            ),
        );
        if (street && isTarget(street)) nearest.add(key);
    }

    // A cell's sample says little about its edges: one cell of margin
    const neighbours = (key: number) => {
        const [i, j] = cellOf(key);
        const keys: number[] = [];
        for (let di = -1; di <= 1; di++) {
            for (let dj = -1; dj <= 1; dj++) {
                if (di || dj) keys.push(cellKey(i + di, j + dj));
            }
        }
        return keys;
    };
    const possible = new Set<number>(nearest);
    for (const key of nearest) {
        for (const other of neighbours(key)) possible.add(other);
    }
    const certain = new Set(
        [...nearest].filter((key) =>
            neighbours(key).every((other) => nearest.has(other)),
        ),
    );

    const toArea = (cells: Set<number>) => {
        if (cells.size === 0) return null;
        // Runs of cells in a row, joined with the same run in the next rows
        const rows = new Map<number, number[]>();
        for (const key of cells) {
            const [i, j] = cellOf(key);
            const row = rows.get(j);
            if (row) row.push(i);
            else rows.set(j, [i]);
        }
        const boxes: [number, number, number, number][] = [];
        let open = new Map<string, number>();
        for (const j of [...rows.keys()].sort((a, b) => a - b)) {
            const columns = rows.get(j)!.sort((a, b) => a - b);
            const runs: [number, number][] = [];
            for (const i of columns) {
                const last = runs[runs.length - 1];
                if (last && last[1] === i - 1) last[1] = i;
                else runs.push([i, i]);
            }
            const next = new Map<string, number>();
            for (const [from, to] of runs) {
                const id = `${from},${to}`;
                const box = open.get(id);
                if (box !== undefined && boxes[box][3] === j - 1) {
                    boxes[box][3] = j;
                    next.set(id, box);
                } else {
                    next.set(id, boxes.push([from, j, to, j]) - 1);
                }
            }
            open = next;
        }
        const polygons = boxes.map(([i0, j0, i1, j1]) => {
            const [w, s] = toLngLat(
                (i0 - 0.5) * CELL_METERS,
                (j0 - 0.5) * CELL_METERS,
            );
            const [e, n] = toLngLat(
                (i1 + 0.5) * CELL_METERS,
                (j1 + 0.5) * CELL_METERS,
            );
            return turf.bboxPolygon([w, s, e, n]);
        });
        const area =
            polygons.length === 1
                ? polygons[0]
                : turf.union(turf.featureCollection(polygons));
        if (!area) return null;
        // Smooths the steps of the grid by a few meters
        return turf.simplify(area, { tolerance: 0.00003 }) as Feature<
            Polygon | MultiPolygon
        >;
    };

    return { possible: toArea(possible), certain: toArea(certain) };
};
