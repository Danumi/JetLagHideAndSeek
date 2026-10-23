import { describe, expect, it } from "vitest";

import { MATCHING_DECK, RADAR_DISTANCES } from "@/maps/deck";
import {
    askedCards,
    deckCardId,
    photoCardId,
    radarCardId,
    thermometerCardId,
} from "@/maps/repeats";
import { questionSchema } from "@/maps/schema";

const AT = { lat: 48.2, lng: 16.37 };
const ten = new Date(2026, 9, 23, 10, 0).getTime();
const eleven = new Date(2026, 9, 23, 11, 0).getTime();

const district = (adminLevel: number, askedAt: number) =>
    questionSchema.parse({
        id: "matching",
        data: { ...AT, type: "zone", cat: { adminLevel }, askedAt },
    });

describe("cards asked before", () => {
    it("count each card, with the last time it was asked", () => {
        const asked = askedCards(
            [
                district(9, ten),
                district(9, eleven),
                district(10, ten),
                questionSchema.parse({
                    id: "radius",
                    data: {
                        ...AT,
                        radius: 2000,
                        unit: "meters",
                        askedAt: ten,
                    },
                }),
                questionSchema.parse({
                    id: "thermometer",
                    data: {
                        latA: 48.2,
                        lngA: 16.37,
                        latB: 48.21,
                        lngB: 16.37,
                        distance: 1,
                        askedAt: ten,
                    },
                }),
            ],
            [{ key: 1, photo: "tree", askedAt: eleven, status: "pending" }],
        );

        const gemeindebezirk = MATCHING_DECK.find(
            (card) => card.id === "admin-2",
        )!;
        const katastralgemeinde = MATCHING_DECK.find(
            (card) => card.id === "admin-3",
        )!;
        expect(asked.get(deckCardId("matching", gemeindebezirk))).toEqual({
            count: 2,
            last: eleven,
        });
        expect(asked.get(deckCardId("matching", katastralgemeinde))).toEqual({
            count: 1,
            last: ten,
        });
        // 2000 m is the 2 km card
        const twoKilometers = RADAR_DISTANCES.find((d) => d.label === "2 km")!;
        expect(asked.get(radarCardId(twoKilometers))?.count).toBe(1);
        expect(asked.get(thermometerCardId(1))?.count).toBe(1);
        expect(asked.has(thermometerCardId(5))).toBe(false);
        expect(asked.get(photoCardId("tree"))).toEqual({
            count: 1,
            last: eleven,
        });
    });
});
