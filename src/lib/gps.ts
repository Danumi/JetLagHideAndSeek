import { type Id, toast } from "react-toastify";

import { showLocatingToast } from "@/components/LocatingToast";
import { SidebarContext } from "@/components/ui/sidebar-l";
import {
    followMyPosition,
    hiderMode,
    hiderPlacedAt,
    leafletMapContext,
    myPosition,
    pickingLocation,
    type PickTarget,
    questionModified,
    questions,
} from "@/lib/context";
import { t } from "@/lib/i18n";
import { movePreview, PREVIEW_KEY } from "@/maps/preview";

export type LatLng = { lat: number; lng: number };
/** A GPS position, with how far off it may be in meters. */
export type Position = LatLng & { accuracy: number };

/** The blue dot's position is used right away while it is this fresh. */
const FRESH_POSITION_MS = 15_000;
/** How close the map zooms in when it jumps to your position. */
export const MY_POSITION_ZOOM = 15;
/** A position this precise (meters) is good enough for a question. */
export const PRECISE_METERS = 30;
/** How long a new question waits at most for a precise position. */
const PRECISE_WAIT_MS = 10_000;
/** A question's position less precise than this (meters) gets a warning. */
export const IMPRECISE_METERS = 100;
/** A much less precise reading doesn't replace a precise one this recent. */
const KEEP_PRECISE_MS = 10_000;
/** A precise blue dot this recent is taken right away for a question. */
const RECENT_PRECISE_MS = 5_000;
/** Without new readings, a precise blue dot will do after this long. */
const STILL_WAIT_MS = 2_000;

/** When you last came back to the app; positions from before are old. */
let resumedAt = 0;

const isFresh = (position: { at: number }, maxAge = FRESH_POSITION_MS) =>
    position.at >= resumedAt && Date.now() - position.at < maxAge;

/**
 * Whether a new reading replaces the known position. A much less precise one
 * (over 50 m and three times worse, like the phone switching to Wi-Fi
 * positioning for a moment) doesn't push away a precise one from the last
 * few seconds, so the blue dot doesn't jump.
 */
export const replacesPosition = (
    known: { accuracy: number; at: number } | null,
    next: { accuracy: number; at: number },
) =>
    !known ||
    next.at - known.at >= KEEP_PRECISE_MS ||
    next.accuracy <= Math.max(50, 3 * known.accuracy);

/** Passes a reading on to the blue dot (`myPosition`), unless it is worse. */
const reportPosition = (reading: GeolocationPosition): Position => {
    const next = {
        lat: reading.coords.latitude,
        lng: reading.coords.longitude,
        accuracy: reading.coords.accuracy,
        at: Date.now(),
    };
    const known = myPosition.get();
    if (replacesPosition(known && known.at >= resumedAt ? known : null, next)) {
        myPosition.set(next);
    }
    return next;
};

/**
 * Like `navigator.geolocation.watchPosition`, but starts over with fresh
 * readings when you come back to the app or unlock the phone, instead of
 * going on with what the phone still had.
 */
export const watchFreshPosition = (
    onReading: (reading: GeolocationPosition) => void,
    onError: (error: GeolocationPositionError) => void = () => {},
    /** How old the first reading may be, in milliseconds. */
    maximumAge = 10_000,
) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
        return { stop: () => {}, restart: () => {} };
    }
    let watchId: number | null = null;
    const start = (oldest: number) => {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        watchId = navigator.geolocation.watchPosition(onReading, onError, {
            enableHighAccuracy: true,
            maximumAge: oldest,
        });
    };
    const onVisibilityChange = () => {
        if (document.visibilityState !== "visible") return;
        resumedAt = Date.now();
        start(0);
    };
    start(maximumAge);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return {
        stop: () => {
            document.removeEventListener(
                "visibilitychange",
                onVisibilityChange,
            );
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        },
        /** Asks the phone for fresh readings. */
        restart: () => start(0),
    };
};

let restartMyPosition = () => {};

/**
 * Keeps `myPosition` (the blue dot) up to date until the returned function
 * stops it.
 */
export const watchMyPosition = () => {
    // No dot without permission or signal; questions still ask for GPS
    const watch = watchFreshPosition(reportPosition);
    restartMyPosition = watch.restart;
    return () => {
        watch.stop();
        restartMyPosition = () => {};
    };
};

/** The device's position (accuracy in meters), or null when the browser can't or won't tell. */
export const getCurrentPosition = (): Promise<Position | null> =>
    new Promise((resolve) => {
        const known = myPosition.get();
        if (known && isFresh(known)) {
            resolve(known);
            return;
        }
        if (typeof navigator === "undefined" || !navigator.geolocation) {
            resolve(known);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (reading) => resolve(reportPosition(reading)),
            // The blue dot follows the phone, so it is still the best guess
            // and isn't worth a long wait
            () => resolve(known),
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: known ? 3_000 : 10_000,
            },
        );
    });

/**
 * Waits up to 10 s for a position within 30 m, from fresh readings.
 * `onProgress` gets the most precise position so far; `stopWaiting` stops
 * waiting and takes it. Without a precise one it takes the most precise of
 * those seconds, without any the blue dot (null without one either).
 */
export const findPrecisePosition = (
    onProgress: (best: Position | null) => void,
) => {
    let stopWaiting = () => {};
    const position = new Promise<Position | null>((resolve) => {
        const known = myPosition.get();
        // Older ones may be off already on a tram
        if (
            known &&
            isFresh(known, RECENT_PRECISE_MS) &&
            known.accuracy <= PRECISE_METERS
        ) {
            resolve(known);
            return;
        }
        if (typeof navigator === "undefined" || !navigator.geolocation) {
            resolve(known);
            return;
        }

        // Fresh readings only; until there is one, a recent blue dot
        let best: Position | null = null;
        const recentDot = () => {
            const dot = myPosition.get();
            return dot && isFresh(dot) ? dot : null;
        };
        const finish = () => {
            clearTimeout(timer);
            clearTimeout(stillTimer);
            watch.stop();
            // The blue dot follows the phone, so it is still the best guess
            resolve(best ?? myPosition.get());
        };
        const timer = setTimeout(finish, PRECISE_WAIT_MS);
        // A phone standing still may send no new readings for a while
        const stillTimer = setTimeout(() => {
            const dot = recentDot();
            if (!best && dot && dot.accuracy <= PRECISE_METERS) finish();
        }, STILL_WAIT_MS);
        stopWaiting = finish;
        const watch = watchFreshPosition(
            (reading) => {
                const next = reportPosition(reading);
                if (!best || next.accuracy <= best.accuracy) {
                    best = next;
                    onProgress(best);
                }
                if (next.accuracy <= PRECISE_METERS) finish();
            },
            // No point in waiting without permission
            (error) => {
                if (error.code === error.PERMISSION_DENIED) finish();
            },
            0,
        );
        onProgress(recentDot());
    });
    return { position, stopWaiting: () => stopWaiting() };
};

/**
 * The position for a new question: waits for a precise one (see
 * `findPrecisePosition`) and meanwhile shows how precise it is so far, with
 * "Use anyway".
 */
export const getPrecisePosition = async () => {
    let toastId: Id | undefined;
    const search = findPrecisePosition((best) => {
        toastId = showLocatingToast(
            best?.accuracy,
            () => search.stopWaiting(),
            toastId,
        );
    });
    try {
        return await search.position;
    } finally {
        if (toastId !== undefined) toast.dismiss(toastId);
    }
};

/**
 * Puts your own position (the blue dot) in the middle of the map, and keeps
 * it there until you move the map. False when there is no position.
 */
export const followMe = async () => {
    const map = leafletMapContext.get();
    // Fresh readings instead of what the phone still had; the map follows
    // the blue dot as they come in
    restartMyPosition();
    const position = myPosition.get() ?? (await getCurrentPosition());
    if (!map || !position) return false;
    followMyPosition.set(true);
    map.setView(
        [position.lat, position.lng],
        Math.max(map.getZoom(), MY_POSITION_ZOOM),
    );
    return true;
};

/**
 * Where a new question starts: the seekers' precise GPS position, or the map
 * center when there is no GPS fix (the marker can still be dragged).
 */
export const questionLocation = async (): Promise<
    (LatLng & { accuracy?: number }) | null
> => {
    const position = await getPrecisePosition();
    if (position) {
        return {
            lat: position.lat,
            lng: position.lng,
            accuracy: position.accuracy,
        };
    }

    const map = leafletMapContext.get();
    if (!map) return null;
    toast.warning(t("locating.mapCenter"), { autoClose: 6000 });
    const center = map.getCenter();
    return { lat: center.lat, lng: center.lng };
};

/** Opens the questions sidebar and scrolls to the question just added. */
export const showQuestion = (questionKey: number) => {
    // Wait for the question drawer to close, or it takes the sidebar with it
    setTimeout(() => {
        const sidebar = SidebarContext.get();
        if (sidebar.isMobile) {
            sidebar.setOpenMobile(true);
        } else {
            sidebar.setOpen(true);
        }
    }, 500);
    // Then wait for the sidebar to open and the card to render
    setTimeout(() => scrollToQuestion(questionKey), 900);
};

/** Scrolls the questions to this question's card. */
export const scrollToQuestion = (questionKey: number) =>
    document
        .querySelector(`[data-question-key="${questionKey}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });

/**
 * Moves a question's point (a thermometer's start or end) or the hider's H
 * marker. `accuracy`: how precise a GPS position was, none when set by hand.
 */
const movePoint = (target: PickTarget, at: LatLng, accuracy?: number) => {
    if (target.questionKey === -1) {
        if (hiderMode.get() !== false) {
            hiderMode.set({ latitude: at.lat, longitude: at.lng });
            hiderPlacedAt.set(Date.now());
        }
        return;
    }
    if (target.questionKey === PREVIEW_KEY) {
        movePreview(at);
        return;
    }
    const question = questions.get().find((q) => q.key === target.questionKey);
    // Answered questions stay where they were asked
    if (!question || !question.data.drag) return;
    if (question.id === "thermometer") {
        if (target.point === "end") {
            question.data.latB = at.lat;
            question.data.lngB = at.lng;
            question.data.accuracyB = accuracy;
        } else {
            question.data.latA = at.lat;
            question.data.lngA = at.lng;
            question.data.accuracyA = accuracy;
        }
    } else {
        question.data.lat = at.lat;
        question.data.lng = at.lng;
        question.data.accuracy = accuracy;
    }
    questionModified();
};

/** "Use my location": moves the point to where this phone is. */
export const moveToMyLocation = async (target: PickTarget) => {
    const position = await getPrecisePosition();
    if (!position) {
        toast.error(t("locate.failed"), { autoClose: 3000 });
        return;
    }
    movePoint(target, position, position.accuracy);
};

/**
 * "Pick on map": puts the questions away so the map is free; the next tap on
 * the map moves the point there.
 */
export const pickOnMap = (target: PickTarget) => {
    pickingLocation.set(target);
    const sidebar = SidebarContext.get();
    if (sidebar.isMobile) sidebar.setOpenMobile(false);
};

/** Not the hider's H marker (-1) or the question only looked at (-2). */
const isQuestionKey = (key: number) => key >= 0;

/** Ends "Pick on map" without moving anything and shows the question again. */
export const cancelPickOnMap = () => {
    const target = pickingLocation.get();
    pickingLocation.set(null);
    if (target && isQuestionKey(target.questionKey)) {
        showQuestion(target.questionKey);
    }
};

/**
 * The tap on the map while "Pick on map" is on: moves the point there and
 * shows the question again. False when nothing was being picked.
 */
export const placePickedPoint = (at: LatLng) => {
    const target = pickingLocation.get();
    if (!target) return false;
    pickingLocation.set(null);
    movePoint(target, at);
    if (isQuestionKey(target.questionKey)) showQuestion(target.questionKey);
    return true;
};
