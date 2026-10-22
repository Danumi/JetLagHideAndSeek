import * as turf from "@turf/turf";
import _ from "lodash";

import {
    disabledStations,
    displayHidingZones,
    displayHidingZonesStyle,
    followMyPosition,
    hidingRadius,
    hidingRadiusUnits,
    keptZonesRuledOut,
    leafletMapContext,
    selectedZoneId,
    trainStations,
} from "@/lib/context";
import type { StationCircle } from "@/maps/api";

export const stationId = (station: StationCircle) =>
    station.properties.properties.id as string;

/** Hiding zones not ruled out by the questions or by hand. */
export const zonesLeft = (stations: StationCircle[], disabled: string[]) =>
    stations.filter((station) => !disabled.includes(stationId(station)));

export const toggleZone = (id: string) => {
    const disabled = disabledStations.get();
    disabledStations.set(
        disabled.includes(id)
            ? disabled.filter((x) => x !== id)
            : [...disabled, id],
    );
};

/**
 * The hiding zone left at a point on the map, or "" for none. Where zones
 * overlap, the one whose station is nearest.
 */
export const zoneAt = (at: { lat: number; lng: number }) => {
    const radiusMeters = turf.convertLength(
        hidingRadius.get(),
        hidingRadiusUnits.get(),
        "meters",
    );
    let nearest = { id: "", meters: Infinity };
    for (const station of zonesLeft(
        trainStations.get(),
        disabledStations.get(),
    )) {
        const meters = turf.distance(
            [at.lng, at.lat],
            station.properties.geometry.coordinates,
            { units: "meters" },
        );
        if (meters <= radiusMeters && meters < nearest.meters) {
            nearest = { id: stationId(station), meters };
        }
    }
    return nearest.id;
};

/** A tap on the map: picks the zone there, or closes the zone shown. */
export const tapZoneAt = (at: { lat: number; lng: number }) => {
    const visible =
        displayHidingZones.get() &&
        displayHidingZonesStyle.get() !== "no-display";
    selectedZoneId.set(visible ? zoneAt(at) : "");
};

/** Picks a zone from the zone list and moves the map to it. */
export const showZone = (id: string) => {
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
