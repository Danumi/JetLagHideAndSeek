import {
    followMyPosition,
    hiderMode,
    hiderPlacedAt,
    hiderScreenOpen,
    leafletMapContext,
    myPosition,
    questions,
    roleChosen,
    VIENNA,
} from "@/lib/context";

/*
 * Every phone is either a seeker's or the hider's. Seekers get the map with
 * "Ask a question", the hider gets the hider screen. The hider's phone is
 * the one with a hider location (`hiderMode`).
 */

export type Role = "seeker" | "hider";

export const currentRole = (): Role =>
    hiderMode.get() === false ? "seeker" : "hider";

/** The hider starts at the blue dot, else where the map is, until GPS knows better. */
const startHiderMode = () => {
    if (hiderMode.get() !== false) return;
    const position = myPosition.get();
    const center = leafletMapContext.get()?.getCenter();
    hiderMode.set(
        position
            ? { latitude: position.lat, longitude: position.lng }
            : center
              ? { latitude: center.lat, longitude: center.lng }
              : {
                    latitude: VIENNA.geometry.coordinates[0],
                    longitude: VIENNA.geometry.coordinates[1],
                },
    );
};

export const setRole = (role: Role) => {
    roleChosen.set(true);
    hiderPlacedAt.set(null);
    if (role === "hider") {
        startHiderMode();
        hiderScreenOpen.set(true);
    } else {
        hiderMode.set(false);
        hiderScreenOpen.set(false);
        followMyPosition.set(true);
    }
};

/**
 * What a question link from the seekers does on this phone: the hider's
 * phone answers it, a seeker's phone stays one (the link may have been
 * tapped in the group chat), and a phone that never picked a role and has
 * no questions of its own becomes the hider's.
 */
export const questionLinkRole = (): Role | "becomes-hider" => {
    if (currentRole() === "hider") return "hider";
    if (roleChosen.get() || questions.get().length > 0) return "seeker";
    return "becomes-hider";
};
