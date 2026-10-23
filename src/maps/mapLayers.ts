import { persistentAtom } from "@nanostores/persistent";
import * as turf from "@turf/turf";
import type { Feature, LineString, Position } from "geojson";
import { atom } from "nanostores";

import type { Text } from "@/lib/i18n";
import { messages } from "@/lib/messages";
import type { APILocations } from "@/maps/api";
import { GROUPS, MATCHING_DECK, MEASURING_DECK } from "@/maps/deck";

/*
 * What players can show on the map besides the zones: the places of the
 * question cards (every museum, hospital, park, ...), bodies of water and the
 * U-Bahn, S-Bahn and tram lines. The places come from the same queries as the
 * questions, so "New Game" has already loaded them.
 */

export type MapLayer = {
    /** The card's id, like "museum" or "water"; "u-bahn", "s-bahn", "tram". */
    id: string;
    group: Text;
    label: Text;
    color: string;
    /** Its symbol (Lucide, ISC license) as SVG markup. */
    icon: string;
    /** Places are drawn as small symbols; the other layers as lines. */
    location?: APILocations;
    /** Lines: the OSM route type ("subway", "train", "tram"). */
    route?: string;
    /** The colours in the list, if the lines have several. */
    colors?: string[];
};

const ICONS = {
    train: '<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/><path d="m9 15-1-1"/><path d="m15 15 1-1"/><path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/><path d="m8 19-2 3"/><path d="m16 19 2 3"/>',
    tram: '<rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><path d="M8 15h.01"/><path d="M16 15h.01"/>',
    mountain: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
    trees: '<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/>',
    waves: '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
    ferrisWheel:
        '<circle cx="12" cy="12" r="2"/><path d="M12 2v4"/><path d="m6.8 15-3.5 2"/><path d="m20.7 7-3.5 2"/><path d="M6.8 9 3.3 7"/><path d="m20.7 17-3.5-2"/><path d="m9 22 3-8 3 8"/><path d="M8 22h8"/><path d="M18 18.7a9 9 0 1 0-12 0"/>',
    pawPrint:
        '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>',
    fish: '<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z"/><path d="M18 12v.5"/><path d="M16 17.93a9.77 9.77 0 0 1 0-11.86"/><path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33"/><path d="M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4"/><path d="m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98"/>',
    golfFlag: '<path d="M7 22V2l10 5-10 5"/>',
    landmark:
        '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
    clapperboard:
        '<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    hospital:
        '<path d="M12 6v4"/><path d="M14 14h-4"/><path d="M14 18h-4"/><path d="M14 8h-4"/><path d="M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2"/><path d="M18 22V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v18"/>',
    bookOpen:
        '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
};

const card = (id: string) =>
    [...MATCHING_DECK, ...MEASURING_DECK].find((card) => card.id === id)!;

/** A layer named like its question card. */
const cardLayer = (
    id: string,
    color: string,
    icon: string,
    location?: APILocations,
): MapLayer => ({
    id,
    group: card(id).group,
    label: card(id).label,
    color,
    icon,
    location,
});

/** In the order of the deck. Colours apart from the zones' green and grey. */
export const MAP_LAYERS: MapLayer[] = [
    {
        id: "u-bahn",
        group: GROUPS.transit,
        label: messages["layers.uBahn"],
        color: "#e3000f",
        icon: ICONS.train,
        route: "subway",
        // U1, U2, U3, U4, U6
        colors: ["#e3000f", "#a862a4", "#ef7c00", "#319f49", "#9d6830"],
    },
    {
        id: "s-bahn",
        group: GROUPS.transit,
        label: messages["layers.sBahn"],
        color: "#159dd9",
        icon: ICONS.train,
        route: "train",
    },
    {
        id: "tram",
        group: GROUPS.transit,
        label: messages["layers.tram"],
        // Apart from the U1's red: darker, and the lines are thinner
        color: "#9f1239",
        icon: ICONS.tram,
        route: "tram",
    },
    cardLayer("mountain", "#92400e", ICONS.mountain, "peak"),
    cardLayer("park", "#15803d", ICONS.trees, "park"),
    cardLayer("water", "#0369a1", ICONS.waves),
    cardLayer("amusement-park", "#db2777", ICONS.ferrisWheel, "theme_park"),
    cardLayer("zoo", "#a16207", ICONS.pawPrint, "zoo"),
    cardLayer("aquarium", "#0891b2", ICONS.fish, "aquarium"),
    cardLayer("golf-course", "#65a30d", ICONS.golfFlag, "golf_course"),
    cardLayer("museum", "#7c3aed", ICONS.landmark, "museum"),
    cardLayer("movie-theater", "#be123c", ICONS.clapperboard, "cinema"),
    cardLayer("hospital", "#dc2626", ICONS.hospital, "hospital"),
    cardLayer("library", "#4f46e5", ICONS.bookOpen, "library"),
    cardLayer("consulate", "#0f766e", ICONS.flag, "consulate"),
];

export const mapLayer = (id: string) =>
    MAP_LAYERS.find((layer) => layer.id === id);

/** The layers this phone shows, by id. */
export const shownMapLayers = persistentAtom<string[]>("mapLayers", [], {
    encode: JSON.stringify,
    decode: JSON.parse,
});

export const toggleMapLayer = (id: string, show: boolean) => {
    const shown = shownMapLayers.get();
    if (shown.includes(id) === show) return;
    shownMapLayers.set(
        show ? [...shown, id] : shown.filter((other) => other !== id),
    );
};

/** Places of shown layers that are too many to draw until zoomed in. */
export const tooManyPlacesInView = atom<string[]>([]);

export const markTooManyPlaces = (id: string, tooMany: boolean) => {
    const current = tooManyPlacesInView.get();
    if (current.includes(id) === tooMany) return;
    tooManyPlacesInView.set(
        tooMany ? [...current, id] : current.filter((other) => other !== id),
    );
};

/** More places than this in view are drawn only after zooming in (parks). */
export const MAX_PLACES_IN_VIEW = 150;

/** A layer's symbol: a white circle with its icon, as on the map. */
export const placeSymbolHtml = (layer: MapLayer, size = 24) =>
    `<div style="width:${size}px;height:${size}px;box-sizing:border-box;border-radius:9999px;display:flex;align-items:center;justify-content:center;background:#fff;border:2px solid ${layer.color};box-shadow:0 1px 2px rgba(0,0,0,.35)"><svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(size * 0.58)}" height="${Math.round(size * 0.58)}" viewBox="0 0 24 24" fill="none" stroke="${layer.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${layer.icon}</svg></div>`;

type Bounds = { south: number; west: number; north: number; east: number };

/** The places to draw in view, or null if there are too many. */
export const placesInView = <P extends { lat: number; lng: number }>(
    places: P[],
    view: Bounds,
    max = MAX_PLACES_IN_VIEW,
): P[] | null => {
    const inView = places.filter(
        (place) =>
            place.lat >= view.south &&
            place.lat <= view.north &&
            place.lng >= view.west &&
            place.lng <= view.east,
    );
    return inView.length > max ? null : inView;
};

/**
 * Where to put the name of each line ("U4"): in the game area, the middle of
 * its longest piece, or further along when another line's name is already
 * close by (the S-Bahn lines share their tracks through the city).
 */
export const lineLabelPositions = (
    lines: { ref: string; lines: Feature<LineString>[] }[],
    inArea: (at: Position) => boolean = () => true,
    minDistanceKm = 0.8,
) => {
    const placed: { ref: string; at: Position }[] = [];
    for (const line of lines) {
        const all = line.lines
            .map((piece) => ({ piece, length: turf.length(piece) }))
            .sort((a, b) => b.length - a.length)
            .slice(0, 10)
            .flatMap(({ piece, length }) =>
                [0.5, 0.3, 0.7, 0.15, 0.85].map(
                    (share) =>
                        turf.along(piece, length * share).geometry.coordinates,
                ),
            );
        const inside = all.filter(inArea);
        const candidates = inside.length > 0 ? inside : all;
        if (candidates.length === 0) continue;
        const free = candidates.find((at) =>
            placed.every(
                (other) => turf.distance(other.at, at) >= minDistanceKm,
            ),
        );
        // Everywhere crowded: in the middle after all
        placed.push({ ref: line.ref, at: free ?? candidates[0] });
    }
    return placed;
};

/** The line tapped on the map ("U4"), while it is highlighted. */
export const selectedTransitLine = atom<string | null>(null);

/** Taps this close to a line (on the screen, in pixels) are on it. */
export const LINE_TAP_PX = 14;

type Pixel = { x: number; y: number };

/** From a point to the piece between a and b, on the screen. */
const pixelDistance = (point: Pixel, a: Pixel, b: Pixel) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const share =
        dx === 0 && dy === 0
            ? 0
            : Math.max(
                  0,
                  Math.min(
                      1,
                      ((point.x - a.x) * dx + (point.y - a.y) * dy) /
                          (dx * dx + dy * dy),
                  ),
              );
    return Math.hypot(
        point.x - (a.x + share * dx),
        point.y - (a.y + share * dy),
    );
};

/**
 * The lines near a tap on the map, the nearest first. Lines on the same
 * tracks (the S-Bahn through the city) are all there, in their order.
 */
export const linesAt = (
    lines: { ref: string; lines: Feature<LineString>[] }[],
    at: Position,
    /** Where a point is on the screen, in pixels. */
    toPixel: (at: Position) => Pixel,
    maxPixels = LINE_TAP_PX,
) => {
    const tap = toPixel(at);
    const found: { ref: string; distance: number }[] = [];
    for (const line of lines) {
        let nearest = Infinity;
        for (const piece of line.lines) {
            // Most pieces are nowhere near
            const [west, south, east, north] = turf.bbox(piece);
            const topLeft = toPixel([west, north]);
            const bottomRight = toPixel([east, south]);
            if (
                tap.x < topLeft.x - maxPixels ||
                tap.x > bottomRight.x + maxPixels ||
                tap.y < topLeft.y - maxPixels ||
                tap.y > bottomRight.y + maxPixels
            ) {
                continue;
            }
            const points = piece.geometry.coordinates.map(toPixel);
            for (let i = 1; i < points.length; i++) {
                nearest = Math.min(
                    nearest,
                    pixelDistance(tap, points[i - 1], points[i]),
                );
            }
        }
        if (nearest <= maxPixels)
            found.push({ ref: line.ref, distance: nearest });
    }
    // Shared tracks are mapped as separate ways at times: a pixel apart
    // is the same
    return found
        .sort((a, b) => Math.round(a.distance) - Math.round(b.distance))
        .map(({ ref }) => ref);
};

/** A body of water's name and where it can go on the map. */
export type WaterLabel = {
    name: string;
    /** Across all its parts, in kilometers (the Danube: about 20). */
    size: number;
    /** Points along it, about one per kilometer. */
    candidates: Position[];
};

/** Pieces of the same water close to each other (within about 500 m). */
const clusters = (pieces: Feature<LineString>[]) => {
    const near = 0.005;
    const boxes = pieces.map((piece) => turf.bbox(piece));
    const parent = pieces.map((_, i) => i);
    const root = (i: number): number =>
        parent[i] === i ? i : (parent[i] = root(parent[i]));
    for (let i = 0; i < pieces.length; i++) {
        for (let j = i + 1; j < pieces.length; j++) {
            const [w1, s1, e1, n1] = boxes[i];
            const [w2, s2, e2, n2] = boxes[j];
            if (
                w1 - near <= e2 &&
                w2 - near <= e1 &&
                s1 - near <= n2 &&
                s2 - near <= n1
            ) {
                parent[root(i)] = root(j);
            }
        }
    }
    const groups = new Map<number, Feature<LineString>[]>();
    pieces.forEach((piece, i) =>
        groups.set(root(i), [...(groups.get(root(i)) ?? []), piece]),
    );
    return [...groups.values()];
};

/**
 * Where to write the name of each body of water, the largest first. Ponds
 * of the same name in different places ("Seerosenteich") each get their own.
 */
export const waterLabels = (
    lines: Feature<LineString, { name?: string }>[],
): WaterLabel[] => {
    const byName = new Map<string, Feature<LineString>[]>();
    for (const line of lines) {
        const name = line.properties?.name;
        if (!name) continue;
        byName.set(name, [...(byName.get(name) ?? []), line]);
    }
    return [...byName]
        .flatMap(([name, pieces]) =>
            clusters(pieces).map((cluster) => ({ name, cluster })),
        )
        .map(({ name, cluster }) => {
            const [west, south, east, north] = turf.bbox(
                turf.featureCollection(cluster),
            );
            const candidates = cluster.flatMap((piece) => {
                const length = turf.length(piece);
                const steps = Math.max(1, Math.floor(length));
                return Array.from(
                    { length: steps },
                    (_, i) =>
                        turf.along(piece, (length * (i + 0.5)) / steps).geometry
                            .coordinates,
                );
            });
            return {
                name,
                size: turf.distance([west, south], [east, north]),
                candidates,
            };
        })
        .sort((a, b) => b.size - a.size);
};

/**
 * The names to write in view: only bodies of water big enough to see at this
 * zoom, each once, near the middle of the view and not on top of another.
 */
export const waterLabelsInView = (
    labels: WaterLabel[],
    view: Bounds,
    /** Where a point is on the screen, in pixels. */
    toPixel: (at: Position) => { x: number; y: number },
    pixelsPerKm: number,
    { minPixels = 40, max = 30 } = {},
) => {
    const middle = toPixel([
        (view.west + view.east) / 2,
        (view.south + view.north) / 2,
    ]);
    const placed: { name: string; at: Position; x: number; y: number }[] = [];
    for (const label of labels) {
        if (placed.length >= max) break;
        // Only water bigger on the screen than its name
        const width = label.name.length * 7;
        if (label.size * pixelsPerKm < Math.max(minPixels, width)) continue;
        const spot = label.candidates
            .filter(
                ([lng, lat]) =>
                    lat >= view.south &&
                    lat <= view.north &&
                    lng >= view.west &&
                    lng <= view.east,
            )
            .map((at) => ({ at, ...toPixel(at) }))
            .sort(
                (a, b) =>
                    Math.hypot(a.x - middle.x, a.y - middle.y) -
                    Math.hypot(b.x - middle.x, b.y - middle.y),
            )
            .find((spot) =>
                placed.every(
                    (other) =>
                        Math.abs(other.x - spot.x) >
                            (width + other.name.length * 7) / 2 ||
                        Math.abs(other.y - spot.y) > 24,
                ),
            );
        if (spot) placed.push({ name: label.name, ...spot });
    }
    return placed.map(({ name, at }) => ({ name, at }));
};
