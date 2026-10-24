import * as turf from "@turf/turf";
import _ from "lodash";

import { mapGeoJSON } from "@/lib/context";
import { memoizeAsync } from "@/lib/utils";
import {
    findTransitLines,
    type StationPlace,
    type TransitLine,
} from "@/maps/api";
import { findHidingZoneStations } from "@/maps/stations";

/*
 * "Transit Line" with the U-Bahn only (house rule since 2026-10-24): the
 * seekers name the U-Bahn line they are riding, the answer is yes if it
 * stops at the hider's station. Which line stops where comes from the
 * U-Bahn routes the map shows (`findTransitLines`, preloaded and in the map
 * data package): no query depends on where the seekers are, so it works
 * without a server.
 */

/** A stop belongs to the station nearest to it, at most this far away. */
const STOP_TO_STATION_METERS = 300;

export interface SubwayLine {
    /** "subway:U4", as saved in the question (`lineKey`). */
    key: string;
    /** What players see: "U4". */
    label: string;
    /** Ids of the hiding-zone stations it stops at. */
    stationIds: string[];
}

const isSubwayStation = (station: StationPlace) => {
    const properties = station.properties as Record<string, unknown>;
    return properties.subway === "yes" || properties.station === "subway";
};

/** The station nearest to a point, or null without stations. */
export const nearestStation = (
    stations: StationPlace[],
    at: { lat: number; lng: number },
): StationPlace | null => {
    if (stations.length === 0) return null;
    const nearest = turf.nearestPoint(
        turf.point([at.lng, at.lat]),
        turf.featureCollection(stations) as any,
    );
    return stations[nearest.properties.featureIndex] ?? null;
};

/**
 * The U-Bahn lines among `lines`, each with the stations it stops at: a stop
 * counts for its nearest U-Bahn station. Stations OSM has more than once
 * (Karlsplatz) are merged into one hiding zone, so this is on the merged
 * stations, not on the OSM stations of each line.
 */
export const subwayLinesOf = (
    lines: TransitLine[],
    stations: StationPlace[],
): SubwayLine[] => {
    // Custom station lists have no tags: then all of them
    const subwayStations = stations.some(isSubwayStation)
        ? stations.filter(isSubwayStation)
        : stations;
    return lines
        .filter((line) => line.route === "subway")
        .map((line) => {
            const stationIds = (line.stops ?? []).flatMap((stop) => {
                const station = nearestStation(subwayStations, {
                    lat: stop[1],
                    lng: stop[0],
                });
                if (!station) return [];
                const meters = turf.distance(stop, turf.getCoord(station), {
                    units: "meters",
                });
                return meters <= STOP_TO_STATION_METERS
                    ? [station.properties.id as string]
                    : [];
            });
            return {
                key: `subway:${line.ref}`,
                label: line.ref,
                stationIds: _.uniq(stationIds),
            };
        })
        .filter((line) => line.stationIds.length > 0);
};

const subwayLinesFor = memoizeAsync(
    async (stations: StationPlace[]) =>
        subwayLinesOf(await findTransitLines(), stations),
    (stations) => {
        const area = mapGeoJSON.get();
        return JSON.stringify([
            area ? turf.bbox(area) : null,
            stations.map((station) => [
                station.properties.id,
                turf.getCoord(station),
            ]),
        ]);
    },
);

/** The U-Bahn lines of the game area with the hiding-zone stations they stop at. */
export const findSubwayLines = async (
    stations?: StationPlace[] | null,
): Promise<SubwayLine[]> =>
    subwayLinesFor(stations ?? (await findHidingZoneStations()) ?? []);

/**
 * The seekers' line: the one they chose, or the only line at their nearest
 * station. `atStation` are the lines at that station.
 */
export const seekersLine = (
    lines: SubwayLine[],
    stations: StationPlace[],
    question: { lat: number; lng: number; lineKey?: string },
) => {
    const station = nearestStation(stations, question);
    const atStation = station
        ? lines.filter((line) =>
              line.stationIds.includes(station.properties.id as string),
          )
        : [];
    const chosen =
        lines.find((line) => line.key === question.lineKey) ??
        (atStation.length === 1 ? atStation[0] : undefined);
    return { station, atStation, chosen };
};

/**
 * The stations that count as on the seekers' line. Without a chosen line
 * (at a station of several lines) only certain eliminations are made:
 * "same" keeps the stations of every line there, "different" only rules
 * out stations on all of them.
 */
export const stationsOnSeekersLine = (
    lines: SubwayLine[],
    stations: StationPlace[],
    question: { lat: number; lng: number; lineKey?: string },
    same: boolean,
): Set<string> => {
    const { atStation, chosen } = seekersLine(lines, stations, question);
    if (chosen) return new Set(chosen.stationIds);
    const ids = atStation.map((line) => line.stationIds);
    return new Set(
        same ? _.union(...ids) : ids.length > 0 ? _.intersection(...ids) : [],
    );
};
