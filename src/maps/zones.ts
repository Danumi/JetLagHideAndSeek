import * as turf from "@turf/turf";
import type {
    Feature,
    FeatureCollection,
    MultiPolygon,
    Polygon,
} from "geojson";
import _ from "lodash";
import { atom, computed } from "nanostores";

import {
    allTrainStations,
    disabledStations,
    displayHidingZones,
    displayHidingZonesStyle,
    followMyPosition,
    hideOtherZones,
    hiderMode,
    hiderScreenOpen,
    hiderZoneId,
    hidingRadius,
    hidingRadiusUnits,
    keptZonesRuledOut,
    leafletMapContext,
    selectedZoneId,
    trainStations,
} from "@/lib/context";
import type { StationCircle, StationPlace } from "@/maps/api";
import { holedMask } from "@/maps/geo-utils";

export const stationId = (station: StationCircle) =>
    station.properties.properties.id as string;

/** Hiding zones not ruled out by the questions or by hand. */
export const zonesLeft = (stations: StationCircle[], disabled: string[]) =>
    stations.filter((station) => !disabled.includes(stationId(station)));

/**
 * The zone the hider chose, once the stations are there (violet on their
 * map). Empty on seekers' phones and before choosing.
 */
export const hiderChosenZone = computed(
    [hiderMode, hiderZoneId, allTrainStations],
    (hider, id, stations) =>
        hider !== false && stations.some((x) => x.properties.id === id)
            ? id
            : "",
);

/**
 * "Change" on the hider screen: the hider taps another zone on the map
 * (e.g. after choosing the wrong one), a bar says so.
 */
export const choosingHiderZone = atom(false);

/**
 * The hider's zone kept clean on their map: no other zone's edge runs
 * through it, and a tap in it picks only it. Their chosen zone, except
 * while they choose another one (then the map is as for everyone).
 */
export const hiderOwnZone = computed(
    [hiderChosenZone, choosingHiderZone],
    (id, choosing) => (choosing ? "" : id),
);

/** "Hide other zones": the hider's map shows only their own zone. */
export const hiderOnlyOwnZone = computed(
    [hiderOwnZone, hideOtherZones],
    (own, hide) => (hide ? own : ""),
);

/** A zone's circle as drawn on its own (the violet or the tapped zone). */
export const zoneCircle = (
    station: StationPlace,
    radius: number,
    units: turf.Units,
) =>
    turf.circle(turf.getCoord(station), radius, {
        steps: 32,
        units,
    });

/**
 * The zones as drawn, cut back to the edge of the hider's own zone, so its
 * inside stays clean. The cut runs along the own zone's (violet) edge.
 * Points (the "Stations" view) stay as they are.
 */
export const clearOfZone = (
    shapes: FeatureCollection | Feature,
    own: Feature<Polygon>,
): FeatureCollection => {
    const features =
        shapes.type === "FeatureCollection" ? shapes.features : [shapes];
    const [west, south, east, north] = turf.bbox(own);
    const clear = features.flatMap((feature) => {
        const { geometry } = feature;
        if (geometry?.type !== "Polygon" && geometry?.type !== "MultiPolygon")
            return [feature];
        // Far away: nothing to cut
        const [w, s, e, n] = turf.bbox(feature);
        if (w > east || e < west || s > north || n < south) return [feature];
        try {
            const outside = turf.difference(
                turf.featureCollection([
                    feature as Feature<Polygon | MultiPolygon>,
                    own,
                ]),
            );
            return outside
                ? [{ ...outside, properties: feature.properties }]
                : [];
        } catch (error) {
            console.log("Error cutting a zone at the hider's zone:", error);
            return [feature];
        }
    });
    return turf.featureCollection(clear);
};

/** "Change" on the hider screen: to the map, to tap another zone. */
export const chooseHiderZoneOnMap = () => {
    choosingHiderZone.set(true);
    selectedZoneId.set("");
    hiderScreenOpen.set(false);
};

/** Chosen or cancelled: back to the hider screen. */
export const stopChoosingHiderZone = () => {
    if (!choosingHiderZone.get()) return;
    choosingHiderZone.set(false);
    selectedZoneId.set("");
    hiderScreenOpen.set(true);
};

/**
 * Where the hider can't be because it is outside every zone left, without
 * what the answers already rule out (the map shows that grey already, and
 * grey twice would look darker). Null when there's nothing to show.
 */
export const outsideZones = (
    zones: StationCircle[],
    ruledOut: FeatureCollection | null,
): Feature | null => {
    // Before the zones are worked out (or with none left), nothing is grey
    if (zones.length === 0) return null;
    try {
        const outside = holedMask(
            turf.featureCollection(zones as Feature<Polygon | MultiPolygon>[]),
        );
        const shown = ruledOut?.features?.[0] as
            | Feature<Polygon | MultiPolygon>
            | undefined;
        if (!outside || !shown) return outside;
        return turf.difference(turf.featureCollection([outside, shown]));
    } catch (error) {
        console.log("Error greying out what is outside the zones:", error);
        return null;
    }
};

/**
 * The zones the answers leave light somewhere. A zone whose edge is all
 * grey can still hold a light island inside (typical late in the game), so
 * this looks at what is left, not at the edge.
 */
export const zonesNotRuledOut = <T extends Feature<Polygon | MultiPolygon>>(
    zones: T[],
    ruledOut: FeatureCollection | null,
): T[] => {
    const grey = ruledOut?.features?.[0] as
        | Feature<Polygon | MultiPolygon>
        | undefined;
    if (zones.length === 0 || !grey) return zones;
    try {
        // What the answers leave, around the zones
        const around = turf.bboxPolygon(
            turf.bbox(turf.featureCollection(zones)),
        );
        const left = turf.difference(turf.featureCollection([around, grey]));
        if (!left) return [];
        return zones.filter((zone) => turf.booleanIntersects(zone, left));
    } catch (error) {
        console.log("Error working out the zones left:", error);
        return zones;
    }
};

export const toggleZone = (id: string) => {
    const disabled = disabledStations.get();
    disabledStations.set(
        disabled.includes(id)
            ? disabled.filter((x) => x !== id)
            : [...disabled, id],
    );
};

/**
 * The hiding zones left at a point on the map, the one whose station is
 * nearest first. In the hider's own zone only that one, and with "Hide
 * other zones" no others.
 */
export const zonesAt = (at: { lat: number; lng: number }) => {
    const radiusMeters = turf.convertLength(
        hidingRadius.get(),
        hidingRadiusUnits.get(),
        "meters",
    );
    // In the hider's own zone only it, the others end at its edge (or
    // aren't shown at all)
    const own = allTrainStations
        .get()
        .find((x) => x.properties.id === hiderOwnZone.get());
    if (own) {
        const meters = turf.distance(
            [at.lng, at.lat],
            own.geometry.coordinates,
            { units: "meters" },
        );
        if (meters <= radiusMeters) return [own.properties.id as string];
        if (hiderOnlyOwnZone.get()) return [];
    }
    return _.sortBy(
        zonesLeft(trainStations.get(), disabledStations.get())
            .map((station) => ({
                id: stationId(station),
                meters: turf.distance(
                    [at.lng, at.lat],
                    station.properties.geometry.coordinates,
                    { units: "meters" },
                ),
            }))
            .filter(({ meters }) => meters <= radiusMeters),
        "meters",
    ).map(({ id }) => id);
};

/**
 * The zones under the last tap on the map where zones overlap, for
 * "Karlsplatz · 1 of 3" on the zone shown. Empty under a single zone.
 */
export const tappedZones = atom<string[]>([]);

/** Taps this close together (on screen) are on the same spot. */
const SAME_SPOT_PX = 30;
let lastTap: { lat: number; lng: number } | null = null;

const sameSpot = (
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
) => {
    const map = leafletMapContext.get();
    if (!map) return a.lat === b.lat && a.lng === b.lng;
    return (
        map
            .latLngToContainerPoint(a)
            .distanceTo(map.latLngToContainerPoint(b)) <= SAME_SPOT_PX
    );
};

/** The zone after the one shown among the zones at the tapped spot. */
const nextOf = (ids: string[]) =>
    ids[(ids.indexOf(selectedZoneId.get()) + 1) % ids.length];

/**
 * A tap on the map: picks the zone there, or closes the zone shown. Where
 * zones overlap, the one with the nearest station; each further tap on the
 * same spot picks the next one there.
 */
export const tapZoneAt = (at: { lat: number; lng: number }) => {
    const visible =
        displayHidingZones.get() &&
        displayHidingZonesStyle.get() !== "no-display";
    const ids = visible ? zonesAt(at) : [];
    const again =
        lastTap !== null &&
        sameSpot(lastTap, at) &&
        ids.includes(selectedZoneId.get());

    lastTap = { lat: at.lat, lng: at.lng };
    tappedZones.set(ids.length > 1 ? ids : []);
    selectedZoneId.set(again ? nextOf(ids) : (ids[0] ?? ""));
};

/** "1 of 3" on the zone shown: the next zone at the tapped spot. */
export const nextTappedZone = () => {
    const ids = tappedZones.get();
    if (ids.includes(selectedZoneId.get())) selectedZoneId.set(nextOf(ids));
};

/** Picks a zone from the zone list and moves the map to it. */
export const showZone = (id: string) => {
    lastTap = null;
    tappedZones.set([]);
    selectedZoneId.set(id);
    const station = trainStations.get().find((x) => stationId(x) === id);
    const map = leafletMapContext.get();
    if (!station || !map) return;

    const [west, south, east, north] = turf.bbox(station);
    followMyPosition.set(false);
    map.fitBounds(
        [
            [south, west],
            [north, east],
        ],
        { padding: [40, 40] },
    );
};

/**
 * Rules out every zone left except these ("Only this zone", "Keep only
 * these"). Returns how many were ruled out and how to undo it.
 */
export const keepOnlyZones = (ids: string[]) => {
    const disabled = disabledStations.get();
    const kept = keptZonesRuledOut.get();
    const others = trainStations
        .get()
        .map(stationId)
        .filter((id) => !ids.includes(id) && !disabled.includes(id));

    disabledStations.set([
        ...disabled.filter((id) => !ids.includes(id)),
        ...others,
    ]);
    keptZonesRuledOut.set(_.uniq([...kept, ...others]));

    return {
        ruledOut: others.length,
        undo: () => {
            disabledStations.set(disabled);
            keptZonesRuledOut.set(kept);
        },
    };
};

/** Whether "Show all zones" would bring zones back. */
export const canShowAllZones = (disabled: string[], kept: string[]) =>
    kept.some((id) => disabled.includes(id));

/** Brings back the zones "Only this zone" and "Keep only these" ruled out. */
export const showAllZones = () => {
    const kept = keptZonesRuledOut.get();
    disabledStations.set(
        disabledStations.get().filter((id) => !kept.includes(id)),
    );
    keptZonesRuledOut.set([]);
};
