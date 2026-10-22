import * as turf from "@turf/turf";
import { beforeEach, describe, expect, it } from "vitest";

import {
    allTrainStations,
    followMyPosition,
    hiderMode,
    hiderScreenOpen,
    hiderZoneId,
    hidingRadius,
    hidingRadiusUnits,
    myPosition,
    questions,
    roleChosen,
} from "@/lib/context";
import { currentRole, questionLinkRole, setRole } from "@/lib/role";
import type { StationPlace } from "@/maps/api";
import {
    checkHidingZone,
    hiderZoneCheck,
    zoneCheckText,
} from "@/maps/hidingZoneCheck";
import { questionSchema } from "@/maps/schema";

const station = (name: string, lng: number, lat: number): StationPlace =>
    turf.point([lng, lat], { id: `node/${name}`, name }) as StationPlace;

const KARLSPLATZ = station("Karlsplatz", 16.3699, 48.2006);
const STEPHANSPLATZ = station("Stephansplatz", 16.3721, 48.2084);

/** A point this many meters north of Karlsplatz. */
const northOfKarlsplatz = (meters: number) => {
    const [lng, lat] = turf.destination(
        KARLSPLATZ.geometry.coordinates,
        meters,
        0,
        { units: "meters" },
    ).geometry.coordinates;
    return { lat, lng };
};

describe("hiding zone check", () => {
    it("finds the nearest zone and whether the hider is in it", () => {
        const check = checkHidingZone(
            northOfKarlsplatz(320),
            [STEPHANSPLATZ, KARLSPLATZ],
            500,
        );
        expect(check?.inside).toBe(true);
        expect(check?.station).toBe("Karlsplatz");
        expect(check?.meters).toBeCloseTo(320, 0);
        expect(zoneCheckText(check!)).toEqual({
            title: "Choose your hiding zone",
            detail: "You are in the Karlsplatz zone, 320 m from the station",
        });
        expect(zoneCheckText({ ...check!, chosen: true })).toEqual({
            title: "Your zone: Karlsplatz",
            detail: "320 m from the station",
        });
    });

    it("tells how far the zone is when the hider is outside", () => {
        // South of Karlsplatz, away from Stephansplatz
        const [lng, lat] = turf.destination(
            KARLSPLATZ.geometry.coordinates,
            650,
            180,
            { units: "meters" },
        ).geometry.coordinates;
        const check = checkHidingZone({ lat, lng }, [KARLSPLATZ], 500);
        expect(check?.inside).toBe(false);
        expect(zoneCheckText(check!)).toEqual({
            title: "Choose your hiding zone",
            detail: "Nearest: the Karlsplatz zone, 150 m away",
        });
        expect(zoneCheckText({ ...check!, chosen: true })).toEqual({
            title: "Outside your hiding zone",
            detail: "150 m to the Karlsplatz zone",
        });
    });

    it("has nothing to say without stations", () => {
        expect(checkHidingZone(northOfKarlsplatz(0), [], 500)).toBeNull();
    });

    it("runs live on the hider's phone only", () => {
        hidingRadius.set(500);
        hidingRadiusUnits.set("meters");
        allTrainStations.set([KARLSPLATZ]);
        myPosition.set({ ...northOfKarlsplatz(100), accuracy: 10, at: 0 });

        hiderMode.set(false);
        expect(hiderZoneCheck.get()).toBeNull();

        hiderMode.set({ latitude: 48.2, longitude: 16.37 });
        expect(hiderZoneCheck.get()?.inside).toBe(true);

        // The hider walks away
        myPosition.set({ ...northOfKarlsplatz(700), accuracy: 10, at: 1 });
        expect(hiderZoneCheck.get()?.inside).toBe(false);
    });

    it("only counts the zone the hider chose", () => {
        hidingRadius.set(500);
        hidingRadiusUnits.set("meters");
        allTrainStations.set([KARLSPLATZ, STEPHANSPLATZ]);
        hiderMode.set({ latitude: 48.2, longitude: 16.37 });
        // Where the Karlsplatz and Stephansplatz zones overlap, nearer to
        // Stephansplatz
        myPosition.set({ ...northOfKarlsplatz(470), accuracy: 10, at: 0 });

        hiderZoneId.set("");
        expect(hiderZoneCheck.get()).toMatchObject({
            chosen: false,
            inside: true,
            station: "Stephansplatz",
        });

        hiderZoneId.set("node/Karlsplatz");
        expect(hiderZoneCheck.get()).toMatchObject({
            chosen: true,
            inside: true,
            station: "Karlsplatz",
        });

        // Still in the Stephansplatz zone, but out of the chosen one
        myPosition.set({ ...northOfKarlsplatz(600), accuracy: 10, at: 1 });
        expect(hiderZoneCheck.get()).toMatchObject({
            chosen: true,
            inside: false,
            station: "Karlsplatz",
        });

        // A zone that isn't in the game: back to the nearest zone
        hiderZoneId.set("node/Elsewhere");
        expect(hiderZoneCheck.get()?.chosen).toBe(false);
        hiderZoneId.set("");
    });
});

describe("roles", () => {
    beforeEach(() => {
        hiderMode.set(false);
        hiderScreenOpen.set(false);
        roleChosen.set(false);
        questions.set([]);
        myPosition.set(null);
    });

    it("turns the phone into the hider's and back", () => {
        myPosition.set({ lat: 48.2, lng: 16.37, accuracy: 5, at: 0 });
        setRole("hider");
        expect(currentRole()).toBe("hider");
        expect(hiderMode.get()).toEqual({ latitude: 48.2, longitude: 16.37 });
        expect(hiderScreenOpen.get()).toBe(true);

        followMyPosition.set(false);
        setRole("seeker");
        expect(currentRole()).toBe("seeker");
        expect(hiderScreenOpen.get()).toBe(false);
        expect(followMyPosition.get()).toBe(true);
        expect(roleChosen.get()).toBe(true);
    });

    it("lets a question link make a phone the hider's only if nobody picked a role", () => {
        expect(questionLinkRole()).toBe("becomes-hider");

        // A seeker's phone stays one, e.g. a link tapped in the group chat
        roleChosen.set(true);
        expect(questionLinkRole()).toBe("seeker");

        // Phones from before roles: questions of its own make it a seeker's
        roleChosen.set(false);
        questions.set([
            questionSchema.parse({
                id: "radius",
                key: 1,
                data: { lat: 48.2, lng: 16.37 },
            }),
        ]);
        expect(questionLinkRole()).toBe("seeker");

        setRole("hider");
        expect(questionLinkRole()).toBe("hider");
    });
});
