import { beforeEach, describe, expect, it, vi } from "vitest";

import { hiderZoneId } from "@/lib/context";
import { trainLineNodeFinder } from "@/maps/api";
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
    trainLineNodeFinder: vi.fn(async () => []),
}));

// The seekers at Schottentor (11 characters)
const question = (type: string) =>
    questionSchema.parse({
        id: "matching",
        data: { lat: 48.2151127, lng: 16.363034, type, status: "pending" },
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
        // Stephansplatz has 13 characters, Schottentor 11
        expect(answered.lengthComparison).toBe("longer");
    });

    it("is the nearest station until the hider chose a zone", async () => {
        const answered = await hiderifyMatching(
            question("same-length-station"),
            HIDER,
        );
        // Herrengasse and Schottentor have 11 characters each
        expect(answered.lengthComparison).toBe("same");
    });

    it("is on a line that stops at any of its OSM stations", async () => {
        hiderZoneId.set("node/3500528328");
        // The line stops at the other Stephansplatz and at Herrengasse
        vi.mocked(trainLineNodeFinder).mockResolvedValueOnce([4560869722]);
        const onLine = await hiderifyMatching(
            question("same-train-line"),
            HIDER,
        );
        expect(onLine.same).toBe(true);

        vi.mocked(trainLineNodeFinder).mockResolvedValueOnce([4348336039]);
        const notOnLine = await hiderifyMatching(
            question("same-train-line"),
            HIDER,
        );
        expect(notOnLine.same).toBe(false);
    });
});
