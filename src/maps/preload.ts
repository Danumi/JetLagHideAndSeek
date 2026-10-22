import { persistentAtom } from "@nanostores/persistent";
import * as turf from "@turf/turf";
import { atom } from "nanostores";

import { displayHidingZones, isLoading, mapGeoJSON } from "@/lib/context";
import { loadingTasks, retryTrigger } from "@/lib/loading";
import {
    type APILocations,
    CacheType,
    clearCache,
    findHighSpeedLines,
    findLandmassIslands,
    findNamedWaterLines,
    findPlacesOfKind,
    findStationLines,
    preloadElevation,
    type StationPlace,
} from "@/maps/api";
import { MATCHING_DECK, MEASURING_DECK } from "@/maps/deck";
import { findHidingZoneStations } from "@/maps/stations";

/*
 * Loads the map data of every question card for the whole game area while the
 * hider hides, so answers change the map without waiting. Everything goes into
 * the same browser cache the questions read from.
 */

/** Progress of loading the data for a whole game, or null when idle. */
export const preloadProgress = atom<{
    done: number;
    total: number;
    finished: boolean;
} | null>(null);

/**
 * When the map data in the cache started being loaded (0: never). A preload
 * that didn't finish keeps this, so the next one continues where it stopped.
 */
const gameDataSince = persistentAtom<number>("gameDataSince", 0, {
    encode: String,
    decode: Number,
});

/** A new game loads map data again once it is older than this. */
const MAX_DATA_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Every kind of place a card of the Small deck asks about (parks, ...). */
export const DECK_PLACE_KINDS = [
    ...new Set(
        [...MATCHING_DECK, ...MEASURING_DECK]
            .map((card) => card.type)
            .filter((type): type is string => !!type?.endsWith("-full"))
            .map((type) => type.replace(/-full$/, "")),
    ),
] as APILocations[];

let currentRun = 0;
let lastRunFailed = false;

/** Resolves once the map isn't busy, so the players' own questions go first. */
const mapIdle = () =>
    new Promise<void>((resolve) => {
        if (!isLoading.get()) return resolve();
        const unbind = isLoading.listen((loading) => {
            if (loading) return;
            unbind();
            resolve();
        });
    });

/** Resolves once the outline of the game area is known. */
const gameAreaReady = () =>
    new Promise<void>((resolve) => {
        if (mapGeoJSON.get()) return resolve();
        const unbind = mapGeoJSON.listen((value) => {
            if (!value) return;
            unbind();
            resolve();
        });
    });

export const preloadGameData = async ({
    refreshOldData = false,
}: { refreshOldData?: boolean } = {}) => {
    const run = ++currentRun;
    const stale = () => run !== currentRun;
    let done = 0;
    let total = 0;
    let failures = 0;
    // Data already saved on this phone takes only seconds to check: show the
    // progress only once something has to be downloaded
    let downloading = false;
    preloadProgress.set(null);

    const report = () => {
        if (!stale() && downloading) {
            preloadProgress.set({ done, total, finished: false });
        }
    };

    /**
     * Runs jobs one at a time: many servers (like the free plan of
     * overpass.ch) answer only one query at a time.
     */
    const runJobs = async (
        jobs: (() => Promise<unknown>)[],
        stopOnFailure = false,
    ) => {
        for (const job of jobs) {
            await mapIdle();
            if (stale() || (stopOnFailure && failures > 0)) return;
            const unbind = loadingTasks.listen((tasks) => {
                if (tasks.length === 0 || downloading) return;
                downloading = true;
                report();
            });
            try {
                await job();
            } catch (error) {
                // The player was offered a retry
                console.log(error);
                failures++;
            } finally {
                unbind();
            }
            done++;
            report();
        }
    };

    const since = gameDataSince.get();
    const tooOld = since > 0 && Date.now() - since > MAX_DATA_AGE_MS;
    if (refreshOldData && tooOld) {
        await clearCache(CacheType.CACHE);
        await clearCache(CacheType.ZONE_CACHE);
    }
    if (since === 0 || (refreshOldData && tooOld)) {
        gameDataSince.set(Date.now());
    }

    const found: { stations: StationPlace[] | null } = { stations: null };
    const areaJobs = [
        async () => {
            found.stations = await findHidingZoneStations();
        },
        ...DECK_PLACE_KINDS.map((kind) => () => findPlacesOfKind(kind)),
        findHighSpeedLines,
        findLandmassIslands,
    ];
    // These are clipped to the outline of the game area
    const outlineJobs = [
        findNamedWaterLines,
        () =>
            preloadElevation(
                turf.bbox(mapGeoJSON.get()!) as [
                    number,
                    number,
                    number,
                    number,
                ],
            ),
    ];
    total = areaJobs.length + outlineJobs.length;
    report();

    await runJobs(areaJobs);
    await gameAreaReady();
    if (stale()) return;
    await runJobs(outlineJobs);

    // The lines of every station, for the "Transit Line" card: one request
    // per station, so stop at the first failure
    const stationIds: string[] = displayHidingZones.get()
        ? (found.stations ?? [])
              .map((station) => station.properties.id)
              .filter((id): id is string => !!id?.startsWith("node/"))
        : [];
    total += stationIds.length;
    report();
    await runJobs(
        stationIds.map((id) => () => findStationLines(id)),
        true,
    );

    if (stale()) return;
    lastRunFailed = failures > 0;
    if (lastRunFailed) {
        preloadProgress.set(null);
        return;
    }

    preloadProgress.set({ done, total, finished: true });
    setTimeout(() => {
        if (!stale()) preloadProgress.set(null);
    }, 4000);
};

// "Retry" also finishes a preload that stopped because a server failed
retryTrigger.listen(() => {
    if (lastRunFailed) preloadGameData();
});
