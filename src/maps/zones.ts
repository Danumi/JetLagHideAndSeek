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
    hiderMode,
    hiderZoneId,
    hidingRadius,
    hidingRadiusUnits,
    keptZonesRuledOut,
    leafletMapContext,
    selectedZoneId,
    trainStations,
} from "@/lib/context";
import type { StationCircle } from "@/maps/api";
import { holedMask } from "@/maps/geo-utils";

export const stationId = (station: StationCircle) =>
    station.properties.properties.id as string;

/** Hiding zones not ruled out by the questions or by hand. */
export const zonesLeft = (stations: StationCircle[], disabled: string[]) =>
    stations.filter((station) => !disabled.includes(stationId(station)));

/**
 * The zone the hider chose, once the stations are there: their map then
 * shows only this zone. Empty on seekers' phones and before choosing.
 */
export const hiderOwnZone = computed(
    [hiderMode, hiderZoneId, allTrainStations],
    (hider, id, stations) =>
        hider !== false && stations.some((x) => x.properties.id === id)
            ? id
            : "",
);

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
 * nearest first. On the hider's map with a chosen zone only that zone, the
 * others aren't shown.
 */
export const zonesAt = (at: { lat: number; lng: number }) => {
    const radiusMeters = turf.convertLength(
        hidingRadius.get(),
        hidingRadiusUnits.get(),
        "meters",
    );
    const own = hiderOwnZone.get();
    const stations = own
        ? allTrainStations.get().filter((x) => x.properties.id === own)
        : zonesLeft(trainStations.get(), disabledStations.get()).map(
              (station) => station.properties,
          );
    return _.sortBy(
        stations
            .map((station) => ({
                id: station.properties.id as string,
                meters: turf.distance(
                    [at.lng, at.lat],
                    station.geometry.coordinates,
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
