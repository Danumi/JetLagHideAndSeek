import { toast } from "react-toastify";

import { SidebarContext } from "@/components/ui/sidebar-l";
import { followMyPosition, leafletMapContext, myPosition } from "@/lib/context";

export type LatLng = { lat: number; lng: number };

/** The blue dot's position is used right away while it is this fresh. */
const FRESH_POSITION_MS = 15_000;
/** How close the map zooms in when it jumps to your position. */
export const MY_POSITION_ZOOM = 15;

/** The device's position (accuracy in meters), or null when the browser can't or won't tell. */
export const getCurrentPosition = (): Promise<
    (LatLng & { accuracy: number }) | null
> =>
    new Promise((resolve) => {
        const known = myPosition.get();
        if (known && Date.now() - known.at < FRESH_POSITION_MS) {
            resolve(known);
            return;
        }
        if (typeof navigator === "undefined" || !navigator.geolocation) {
            resolve(known);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) =>
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                }),
            // The blue dot follows the phone, so it is still the best guess
            // and isn't worth a long wait
            () => resolve(known),
            {
                enableHighAccuracy: true,
                maximumAge: 15_000,
                timeout: known ? 3_000 : 10_000,
            },
        );
    });

/**
 * Puts your own position (the blue dot) in the middle of the map, and keeps
 * it there until you move the map. False when there is no position.
 */
export const followMe = async () => {
    const map = leafletMapContext.get();
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
 * Where a new question starts: the seekers' GPS position, or the map center
 * when there is no GPS fix (the marker can still be dragged).
 */
export const questionLocation = async (): Promise<LatLng | null> => {
    const position = await toast.promise(getCurrentPosition(), {
        pending: "Getting your location...",
    });
    if (position) return position;

    const map = leafletMapContext.get();
    if (!map) return null;
    toast.warning(
        "Couldn't get your location. The question starts at the map center; drag its marker to where you are.",
        { autoClose: 6000 },
    );
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
    setTimeout(() => {
        document
            .querySelector(`[data-question-key="${questionKey}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 900);
};
