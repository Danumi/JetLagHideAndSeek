import * as turf from "@turf/turf";
import { computed } from "nanostores";

import {
    allTrainStations,
    hiderMode,
    hiderZoneId,
    hidingRadius,
    hidingRadiusUnits,
    myPosition,
} from "@/lib/context";
import { formatKilometers } from "@/maps/answers";
import type { StationPlace } from "@/maps/api";
import { extractStationLabel } from "@/maps/geo-utils";

/** Where the hider is compared to the hiding zones. */
export type ZoneCheck = {
    inside: boolean;
    /** The id of the zone's station. */
    id: string;
    /** Whether it is the zone the hider chose, else the nearest zone. */
    chosen: boolean;
    /** The station of the zone. */
    station: string;
    /** Meters from that station. */
    meters: number;
    /** Meters to the edge of that zone. */
    toEdge: number;
    /** How far off the GPS position may be, in meters. */
    accuracy?: number;
};

/** The hiding zone nearest to a position, and whether the position is in it. */
export const checkHidingZone = (
    position: { lat: number; lng: number },
    stations: StationPlace[],
    radiusMeters: number,
): ZoneCheck | null => {
    let nearest: { station: StationPlace; meters: number } | null = null;
    for (const station of stations) {
        const meters = turf.distance(
            [position.lng, position.lat],
            station.geometry.coordinates,
            { units: "meters" },
        );
        if (!nearest || meters < nearest.meters) {
            nearest = { station, meters };
        }
    }
    if (!nearest) return null;

    return {
        inside: nearest.meters <= radiusMeters,
        id: nearest.station.properties.id,
        chosen: false,
        station: extractStationLabel(nearest.station),
        meters: nearest.meters,
        toEdge: Math.abs(radiusMeters - nearest.meters),
    };
};

/** Like "Your zone: Karlsplatz" and "320 m from the station". */
export const zoneCheckText = (check: ZoneCheck) => {
    const fromStation = formatKilometers(check.meters / 1000);
    const toZone = formatKilometers(check.toEdge / 1000);
    if (!check.chosen) {
        return {
            title: "Choose your hiding zone",
            detail: check.inside
                ? `You are in the ${check.station} zone, ${fromStation} from the station`
                : `Nearest: the ${check.station} zone, ${toZone} away`,
        };
    }
    return check.inside
        ? {
              title: `Your zone: ${check.station}`,
              detail: `${fromStation} from the station`,
          }
        : {
              title: "Outside your hiding zone",
              detail: `${toZone} to the ${check.station} zone`,
          };
};

/**
 * The hider's zone check at the blue dot, or null: on seekers' phones,
 * without GPS, or before the stations have loaded. Once the hider chose a
 * zone, only that zone counts, also where zones overlap.
 */
export const hiderZoneCheck = computed(
    [
        hiderMode,
        myPosition,
        allTrainStations,
        hidingRadius,
        hidingRadiusUnits,
        hiderZoneId,
    ],
    (hider, position, stations, radius, units, chosenId) => {
        if (hider === false || !position) return null;
        const chosen = stations.filter(
            (station) => station.properties.id === chosenId,
        );
        const check = checkHidingZone(
            position,
            chosen.length > 0 ? chosen : stations,
            turf.convertLength(radius, units, "meters"),
        );
        return (
            check && {
                ...check,
                chosen: chosen.length > 0,
                accuracy: position.accuracy,
            }
        );
    },
);
