import * as turf from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import { beforeEach, describe, expect, it } from "vitest";

import {
    allTrainStations,
    disabledStations,
    displayHidingZones,
    displayHidingZonesStyle,
    hiderMode,
    hiderZoneId,
    hidingRadius,
    hidingRadiusUnits,
    selectedZoneId,
    trainStations,
} from "@/lib/context";
import type { StationCircle, StationPlace } from "@/maps/api";
import {
    hiderOwnZone,
    nextTappedZone,
    outsideZones,
    showZone,
    tappedZones,
    tapZoneAt,
    zonesAt,
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
        expect(hiderOwnZone.get()).toBe("node/A");
    });

    it("is empty before choosing, on seekers' phones and for unknown zones", () => {
        hiding();
        expect(hiderOwnZone.get()).toBe("");
        hiderZoneId.set("node/Elsewhere");
        expect(hiderOwnZone.get()).toBe("");
        hiderZoneId.set("node/A");
        hiderMode.set(false);
        expect(hiderOwnZone.get()).toBe("");
    });

    it("is the only zone a tap on the hider's map picks", () => {
        hiding();
        hiderZoneId.set("node/A");
        expect(zonesAt(SPOT)).toEqual(["node/A"]);

        tapZoneAt(SPOT);
        expect(selectedZoneId.get()).toBe("node/A");
        expect(tappedZones.get()).toEqual([]);

        // C is there, but not shown
        tapZoneAt(east(700));
        expect(selectedZoneId.get()).toBe("");
    });

    it("counts even when the answers ruled it out", () => {
        hiding();
        hiderZoneId.set("node/A");
        disabledStations.set(["node/A"]);
        expect(zonesAt(SPOT)).toEqual(["node/A"]);
    });

    it("leaves the hider all zones before choosing", () => {
        hiding();
        expect(zonesAt(SPOT)).toEqual(["node/B", "node/A", "node/C"]);
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
