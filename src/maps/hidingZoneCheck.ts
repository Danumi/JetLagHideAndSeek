import * as turf from "@turf/turf";
import { computed } from "nanostores";

import {
    allTrainStations,
    hiderMode,
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
    /** The station of the nearest hiding zone. */
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
        station: extractStationLabel(nearest.station),
        meters: nearest.meters,
        toEdge: Math.abs(radiusMeters - nearest.meters),
    };
};

/** Like "In your hiding zone" and "320 m from Karlsplatz". */
export const zoneCheckText = (check: ZoneCheck) =>
    check.inside
        ? {
              title: "In your hiding zone",
              detail: `${formatKilometers(check.meters / 1000)} from ${check.station}`,
          }
        : {
              title: "Outside the hiding zones",
              detail: `${formatKilometers(check.toEdge / 1000)} to the ${check.station} zone`,
          };

/**
 * The hider's zone check at the blue dot, or null: on seekers' phones,
 * without GPS, or before the stations have loaded.
 */
export const hiderZoneCheck = computed(
    [hiderMode, myPosition, allTrainStations, hidingRadius, hidingRadiusUnits],
    (hider, position, stations, radius, units) => {
        if (hider === false || !position) return null;
        const check = checkHidingZone(
            position,
            stations,
            turf.convertLength(radius, units, "meters"),
        );
        return check && { ...check, accuracy: position.accuracy };
    },
);
