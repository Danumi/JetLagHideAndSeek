import * as turf from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import { beforeEach, describe, expect, it } from "vitest";

import {
    allTrainStations,
    disabledStations,
    displayHidingZones,
    displayHidingZonesStyle,
    hideOtherZones,
    hiderMode,
    hiderScreenOpen,
    hiderZoneId,
    hidingRadius,
    hidingRadiusUnits,
    selectedZoneId,
    trainStations,
} from "@/lib/context";
import type { StationCircle, StationPlace } from "@/maps/api";
import {
    chooseHiderZoneOnMap,
    choosingHiderZone,
    clearOfZone,
    hiderChosenZone,
    hiderOnlyOwnZone,
    nextTappedZone,
    outsideZones,
    showZone,
    stopChoosingHiderZone,
    tappedZones,
    tapZoneAt,
    zonesAt,
    zonesNotRuledOut,
} from "@/maps/zones";

const ORIGIN: [number, number] = [16.37, 48.2];

/** A point this many meters east of the origin. */
const east = (meters: number) => {
    const [lng, lat] = turf.destination(ORIGIN, meters, 90, {
        units: "meters",
    }).geometry.coordinates;
    return { lat, lng };
};

/** A hiding zone of 500 m around a station this many meters east. */
const zone = (name: string, meters: number): StationCircle => {
    const { lat, lng } = east(meters);
    const station = turf.point([lng, lat], {
        id: `node/${name}`,
        name,
    }) as StationPlace;
    return turf.circle([lng, lat], 500, {
        steps: 32,
        units: "meters",
        properties: station,
    }) as StationCircle;
};

// Taps 250 m east of A: B is 50 m away, A 250 m, C 350 m, D too far
const ZONES = [zone("A", 0), zone("B", 300), zone("C", 600), zone("D", 2000)];
const SPOT = east(250);

beforeEach(() => {
    hidingRadius.set(500);
    hidingRadiusUnits.set("meters");
    displayHidingZones.set(true);
    displayHidingZonesStyle.set("zones");
    trainStations.set([...ZONES]);
    allTrainStations.set(ZONES.map((station) => station.properties));
    disabledStations.set([]);
    selectedZoneId.set("");
    hiderMode.set(false);
    hiderZoneId.set("");
    choosingHiderZone.set(false);
    hideOtherZones.set(false);
    // Forgets the last tap
    showZone("");
});

describe("zonesAt", () => {
    it("lists the zones at a point, nearest station first", () => {
        expect(zonesAt(SPOT)).toEqual(["node/B", "node/A", "node/C"]);
    });

    it("leaves out zones that are ruled out", () => {
        disabledStations.set(["node/A"]);
        expect(zonesAt(SPOT)).toEqual(["node/B", "node/C"]);
    });
});

describe("tapping where zones overlap", () => {
    it("picks the nearest station first, then the next on each tap", () => {
        tapZoneAt(SPOT);
        expect(selectedZoneId.get()).toBe("node/B");
        expect(tappedZones.get()).toEqual(["node/B", "node/A", "node/C"]);

        tapZoneAt(SPOT);
        expect(selectedZoneId.get()).toBe("node/A");
        tapZoneAt(SPOT);
        expect(selectedZoneId.get()).toBe("node/C");
        // Round and round
        tapZoneAt(SPOT);
        expect(selectedZoneId.get()).toBe("node/B");
    });

    it("starts again from the nearest at another spot", () => {
        tapZoneAt(SPOT);
        tapZoneAt(SPOT);
        expect(selectedZoneId.get()).toBe("node/A");

        // B (400 m) and C (100 m) reach here
        tapZoneAt(east(700));
        expect(selectedZoneId.get()).toBe("node/C");

        tapZoneAt(east(2100));
        expect(selectedZoneId.get()).toBe("node/D");
        expect(tappedZones.get()).toEqual([]);
    });

    it("closes the zone shown on a tap outside every zone", () => {
        tapZoneAt(SPOT);
        tapZoneAt(east(5000));
        expect(selectedZoneId.get()).toBe("");
        expect(tappedZones.get()).toEqual([]);
    });

    it("starts from the nearest after the zone shown was closed", () => {
        tapZoneAt(SPOT);
        selectedZoneId.set(""); // e.g. "Rule out"
        tapZoneAt(SPOT);
        expect(selectedZoneId.get()).toBe("node/B");
    });

    it("picks nothing while the zones are hidden", () => {
        displayHidingZonesStyle.set("no-display");
        tapZoneAt(SPOT);
        expect(selectedZoneId.get()).toBe("");
    });

    it("goes to the next zone there with the 1 of 3 button", () => {
        tapZoneAt(SPOT);
        nextTappedZone();
        expect(selectedZoneId.get()).toBe("node/A");
        nextTappedZone();
        nextTappedZone();
        expect(selectedZoneId.get()).toBe("node/B");
    });

    it("forgets the tapped spot when a zone is picked from the list", () => {
        tapZoneAt(SPOT);
        showZone("node/A");
        expect(tappedZones.get()).toEqual([]);
        nextTappedZone();
        expect(selectedZoneId.get()).toBe("node/A");
        // A new tap on the old spot starts from the nearest again
        tapZoneAt(SPOT);
        expect(selectedZoneId.get()).toBe("node/B");
    });
});

describe("the hider's own zone", () => {
    const hiding = () => hiderMode.set({ latitude: 48.2, longitude: 16.37 });

    it("is the zone the hider chose", () => {
        hiding();
        hiderZoneId.set("node/A");
        expect(hiderChosenZone.get()).toBe("node/A");
    });

    it("is empty before choosing, on seekers' phones and for unknown zones", () => {
        hiding();
        expect(hiderChosenZone.get()).toBe("");
        hiderZoneId.set("node/Elsewhere");
        expect(hiderChosenZone.get()).toBe("");
        hiderZoneId.set("node/A");
        hiderMode.set(false);
        expect(hiderChosenZone.get()).toBe("");
    });

    it("leaves the hider all zones, before and after choosing", () => {
        hiding();
        expect(zonesAt(SPOT)).toEqual(["node/B", "node/A", "node/C"]);
        hiderZoneId.set("node/A");
        tapZoneAt(east(700));
        expect(selectedZoneId.get()).toBe("node/C");
    });

    it("can be changed from the hider screen", () => {
        hiding();
        hiderZoneId.set("node/A");
        hiderScreenOpen.set(true);

        chooseHiderZoneOnMap();
        expect(choosingHiderZone.get()).toBe(true);
        expect(hiderScreenOpen.get()).toBe(false);
        // All zones while choosing, also in the hider's zone
        tapZoneAt(SPOT);
        expect(selectedZoneId.get()).toBe("node/B");

        // Chosen (or cancelled): back on the hider screen
        hiderZoneId.set("node/B");
        stopChoosingHiderZone();
        expect(choosingHiderZone.get()).toBe(false);
        expect(selectedZoneId.get()).toBe("");
        expect(hiderScreenOpen.get()).toBe(true);
        expect(hiderChosenZone.get()).toBe("node/B");
    });

    it("keeps a tap in the hider's zone to that zone", () => {
        hiding();
        hiderZoneId.set("node/A");
        // B and C overlap A here, but A is the hider's zone
        expect(zonesAt(SPOT)).toEqual(["node/A"]);
        tapZoneAt(SPOT);
        expect(selectedZoneId.get()).toBe("node/A");
        expect(tappedZones.get()).toEqual([]);
        // Outside it, the other zones as usual
        expect(zonesAt(east(700))).toEqual(["node/C", "node/B"]);
        // While choosing another zone, all of them
        choosingHiderZone.set(true);
        expect(zonesAt(SPOT)).toEqual(["node/B", "node/A", "node/C"]);
    });

    it("is the only zone left to tap with the other zones hidden", () => {
        hiding();
        hiderZoneId.set("node/A");
        hideOtherZones.set(true);
        expect(hiderOnlyOwnZone.get()).toBe("node/A");
        expect(zonesAt(SPOT)).toEqual(["node/A"]);
        // C is there, but not shown
        expect(zonesAt(east(700))).toEqual([]);
        // Not while choosing another zone, nor on seekers' phones
        choosingHiderZone.set(true);
        expect(hiderOnlyOwnZone.get()).toBe("");
        choosingHiderZone.set(false);
        hiderMode.set(false);
        expect(hiderOnlyOwnZone.get()).toBe("");
        expect(zonesAt(SPOT)).toEqual(["node/B", "node/A", "node/C"]);
    });

    it("stays on the map after choosing from the zone list", () => {
        hiding();
        hiderScreenOpen.set(false);
        stopChoosingHiderZone();
        expect(hiderScreenOpen.get()).toBe(false);
    });
});

describe("clearOfZone", () => {
    const own = zone("A", 0);
    const inside = (point: { lat: number; lng: number }, shape: Feature) =>
        turf.booleanPointInPolygon(
            [point.lng, point.lat],
            shape as Feature<Polygon>,
        );

    it("cuts the other zones back to the edge of the hider's zone", () => {
        const clear = clearOfZone(turf.featureCollection(ZONES), own);
        // A itself is gone, B keeps only what is outside A, D is untouched
        expect(clear.features).toHaveLength(3);
        const [b, , d] = clear.features;
        expect(b.properties).toEqual(ZONES[1].properties);
        expect(inside(SPOT, b)).toBe(false);
        expect(inside(east(600), b)).toBe(true);
        expect(d).toEqual(ZONES[3]);
    });

    it("cuts merged zones and leaves station points", () => {
        const merged = turf.union(
            turf.featureCollection([ZONES[0], ZONES[1]]),
        ) as Feature<Polygon>;
        const [cut] = clearOfZone(merged, own).features;
        expect(inside(SPOT, cut)).toBe(false);
        expect(inside(east(700), cut)).toBe(true);

        const point = ZONES[1].properties;
        expect(clearOfZone(turf.featureCollection([point]), own)).toEqual(
            turf.featureCollection([point]),
        );
    });
});

describe("outsideZones", () => {
    const at = (point: { lat: number; lng: number }, area: Feature | null) =>
        turf.booleanPointInPolygon(
            [point.lng, point.lat],
            area as Feature<Polygon>,
        );

    it("is grey outside the zones and light inside them", () => {
        const outside = outsideZones(ZONES, null);
        expect(at(SPOT, outside)).toBe(false);
        expect(at(east(2000), outside)).toBe(false);
        expect(at(east(1300), outside)).toBe(true);
        expect(at(east(-1000), outside)).toBe(true);
    });

    it("leaves out what the answers already rule out", () => {
        // The answers rule out everything west of 1 km east
        const { lng } = east(1000);
        const ruledOut = turf.featureCollection([
            turf.bboxPolygon([0, 0, lng, 60]),
        ]);
        const outside = outsideZones(ZONES, ruledOut);
        expect(at(east(-1000), outside)).toBe(false);
        expect(at(east(1300), outside)).toBe(true);
        expect(at(SPOT, outside)).toBe(false);
    });

    it("greys nothing while there are no zones", () => {
        expect(outsideZones([], null)).toBeNull();
    });
});

describe("zonesNotRuledOut", () => {
    /** Grey everywhere except a light circle of this radius around a point. */
    const greyExcept = (point: { lat: number; lng: number }, meters: number) =>
        turf.featureCollection([
            turf.polygon([
                [
                    [0, 0],
                    [60, 0],
                    [60, 60],
                    [0, 60],
                    [0, 0],
                ],
                turf
                    .circle([point.lng, point.lat], meters, {
                        steps: 16,
                        units: "meters",
                    })
                    .geometry.coordinates[0].slice()
                    .reverse(),
            ]),
        ]);

    const names = (zones: StationCircle[]) =>
        zones.map((zone) => zone.properties.properties.name);

    it("keeps a zone with a light island inside, away from its edge", () => {
        // 100 m around a spot 350 m west of A's station: A's edge is all
        // grey, and B (from 200 m west) doesn't reach it
        expect(
            names(zonesNotRuledOut(ZONES, greyExcept(east(-350), 100))),
        ).toEqual(["A"]);
    });

    it("keeps every zone the light part reaches", () => {
        expect(
            names(zonesNotRuledOut(ZONES, greyExcept(east(250), 100))),
        ).toEqual(["A", "B", "C"]);
    });

    it("rules out every zone when nothing is light", () => {
        const allGrey = turf.featureCollection([
            turf.bboxPolygon([0, 0, 60, 60]),
        ]);
        expect(zonesNotRuledOut(ZONES, allGrey)).toEqual([]);
    });

    it("keeps all zones before any answer", () => {
        expect(zonesNotRuledOut(ZONES, null)).toHaveLength(4);
    });
});
