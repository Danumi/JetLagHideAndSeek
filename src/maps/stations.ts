import osmtogeojson from "osmtogeojson";

import {
    customStations,
    displayHidingZonesOptions,
    hidingRadius,
    hidingRadiusUnits,
    includeDefaultStations,
    useCustomStations,
} from "@/lib/context";
import { t } from "@/lib/i18n";
import {
    findPlacesInZone,
    normalizeToStationFeatures,
    type StationPlace,
} from "@/maps/api";
import { mergeDuplicateStation } from "@/maps/geo-utils";

/** Stations of the types chosen for the hiding zones (Small: U-Bahn). */
export const findStationPlaces = async (): Promise<StationPlace[]> => {
    const [filter, ...alternatives] = displayHidingZonesOptions.get();
    // @ts-expect-error osmtogeojson always defines properties with an "id" string
    return osmtogeojson(
        await findPlacesInZone(
            filter,
            t("loading.stations"),
            "nwr",
            "center",
            alternatives,
        ),
    ).features;
};

const customStationPlaces = (): StationPlace[] =>
    normalizeToStationFeatures(customStations.get()).features.map((f) => ({
        type: "Feature",
        geometry: f.geometry,
        properties: {
            id:
                f.properties?.id ||
                `${f.geometry.coordinates[1]},${f.geometry.coordinates[0]}`,
            name: f.properties?.name,
        },
    }));

/**
 * Every station hiding zones are drawn around, as set up in the zone
 * settings, or null if no station type is selected. Stations OSM has more
 * than once are merged into one.
 */
export const findHidingZoneStations = async (): Promise<
    StationPlace[] | null
> => {
    const useCustom = useCustomStations.get();
    const includeDefault = includeDefaultStations.get();
    const needsDefault = !useCustom || includeDefault;
    if (needsDefault && displayHidingZonesOptions.get().length === 0) {
        return null;
    }

    let places: StationPlace[];

    if (!needsDefault) {
        places = customStationPlaces();
    } else {
        places = await findStationPlaces();

        if (useCustom && customStations.get().length > 0 && includeDefault) {
            const seen = new Set<string>();
            const merged: StationPlace[] = [];
            const add = (feat: StationPlace) => {
                const id = feat.properties.id as string | undefined;
                const key =
                    id && id.includes("/")
                        ? `id:${id}`
                        : `pt:${feat.geometry.coordinates[1]},${feat.geometry.coordinates[0]}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    merged.push(feat);
                }
            };
            places.forEach(add);
            customStationPlaces().forEach(add);
            places = merged;
        }
    }

    // OSM has some stations once per line (Karlsplatz three times): one zone
    return mergeDuplicateStation(
        places,
        hidingRadius.get(),
        hidingRadiusUnits.get(),
    );
};

/** Changes to these settings change the stations above. */
export const hidingZoneStationsKey = () =>
    JSON.stringify([
        displayHidingZonesOptions.get(),
        useCustomStations.get(),
        includeDefaultStations.get(),
        useCustomStations.get() ? customStations.get() : [],
        // Duplicates are merged when their zones overlap
        [hidingRadius.get(), hidingRadiusUnits.get()],
    ]);

/** The OSM ids of a station, more than one for a merged station. */
export const stationOsmIds = (place: StationPlace): string[] =>
    place.properties.ids ?? [place.properties.id];
