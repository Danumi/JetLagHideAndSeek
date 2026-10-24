import { beforeEach, describe, expect, it, vi } from "vitest";

import { hiderZoneId } from "@/lib/context";
import { hiderifyMatching } from "@/maps/questions/matching";
import { type MatchingQuestion, questionSchema } from "@/maps/schema";

/** U-Bahn stations as Overpass has them; Stephansplatz twice, like in OSM. */
const STATIONS = [
    { id: 3500528328, name: "Stephansplatz", lat: 48.2080838, lon: 16.3715166 },
    { id: 4560869722, name: "Stephansplatz", lat: 48.2084639, lon: 16.3720438 },
    { id: 4348336039, name: "Herrengasse", lat: 48.2093213, lon: 16.3651022 },
    { id: 4347738147, name: "Schottentor", lat: 48.2151127, lon: 16.363034 },
].map(({ id, name, lat, lon }) => ({
    type: "node",
    id,
    lat,
    lon,
    tags: { name, railway: "station", subway: "yes" },
}));

vi.mock("@/maps/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/maps/api")>()),
    findPlacesInZone: vi.fn(async () => ({ elements: STATIONS })),
    // U-Bahn lines with their stops, a few meters from the stations
    findTransitLines: vi.fn(async () => [
        subway("U1", [16.37205, 48.20845]),
        subway("U2", [16.36305, 48.21515]),
        subway("U3", [16.37155, 48.20805], [16.36515, 48.20935]),
    ]),
}));

const subway = (ref: string, ...stops: [number, number][]) => ({
    ref,
    route: "subway",
    lines: [],
    stops,
});

// The seekers at Schottentor (11 characters)
const question = (type: string, lineKey?: string) =>
    questionSchema.parse({
        id: "matching",
        data: {
            lat: 48.2151127,
            lng: 16.363034,
            type,
            status: "pending",
            lineKey,
        },
    }).data as MatchingQuestion;

// The hider at the Kohlmarkt: in the Stephansplatz zone, nearer to Herrengasse
const HIDER = { latitude: 48.209, longitude: 16.3672 };

describe("the hider's station", () => {
    beforeEach(() => hiderZoneId.set(""));

    it("is the station of the chosen zone, not the nearest one", async () => {
        hiderZoneId.set("node/3500528328");
        const answered = await hiderifyMatching(
            question("same-length-station"),
            HIDER,
        );
        // Stephansplatz has 13 characters, Schottentor 11: only "different",
        // not "longer"
        expect(answered.lengthComparison).toBe("different");
        expect(answered.same).toBe(false);
    });

    it("is the nearest station until the hider chose a zone", async () => {
        const answered = await hiderifyMatching(
            question("same-length-station"),
            HIDER,
        );
        // Herrengasse and Schottentor have 11 characters each
        expect(answered.lengthComparison).toBe("same");
        expect(answered.same).toBe(true);
    });

    it("is on the seekers' U-Bahn line if it stops there", async () => {
        hiderZoneId.set("node/3500528328");
        // The U3 stops at the other OSM station of Stephansplatz
        const onLine = await hiderifyMatching(
            question("same-train-line", "subway:U3"),
            HIDER,
        );
        expect(onLine.same).toBe(true);

        const notOnLine = await hiderifyMatching(
            question("same-train-line", "subway:U2"),
            HIDER,
        );
        expect(notOnLine.same).toBe(false);
    });

    it("takes the only line at the seekers' station if none was chosen", async () => {
        hiderZoneId.set("node/3500528328");
        // Only the U2 stops at Schottentor
        const answered = await hiderifyMatching(
            question("same-train-line"),
            HIDER,
        );
        expect(answered.same).toBe(false);
    });

    it("counts only the U-Bahn: an old bus line is like none chosen", async () => {
        // The hider's nearest station Herrengasse is on the U3, not the U2
        const answered = await hiderifyMatching(
            question("same-train-line", "bus:13A"),
            HIDER,
        );
        expect(answered.same).toBe(false);
    });
});
