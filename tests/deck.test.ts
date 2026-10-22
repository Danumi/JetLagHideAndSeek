import { describe, expect, it } from "vitest";

import {
    cardQuestionData,
    type DeckCard,
    deckGroups,
    MATCHING_DECK,
    matchingCardFor,
    MEASURING_DECK,
    measuringCardFor,
    RADAR_DISTANCES,
    radarDistanceFor,
    THERMOMETER_DISTANCES,
} from "@/maps/deck";
import { questionSchema } from "@/maps/schema";

/** Card name → question type (and admin level) it must create in Vienna. */
const EXPECTED_MATCHING: Record<string, Record<string, string | null>> = {
    Transit: {
        "Commercial Airport": null,
        "Transit Line": "same-train-line",
        "Station Name's Length": "same-length-station",
        "Street or Path": "street",
    },
    "Administrative Divisions": {
        Bundesland: "zone/4",
        Gemeindebezirk: "zone/9",
        Katastralgemeinde: "zone/10",
        "4th Administrative Division": null,
    },
    Natural: {
        Mountain: "peak-full",
        Landmass: "landmass",
        Park: "park-full",
    },
    "Places of Interest": {
        "Amusement Park": "theme_park-full",
        Zoo: "zoo-full",
        Aquarium: "aquarium-full",
        "Golf Course": "golf_course-full",
        Museum: "museum-full",
        "Movie Theater": "cinema-full",
    },
    "Public Utilities": {
        Hospital: "hospital-full",
        Library: "library-full",
        "Foreign Consulate": "consulate-full",
    },
};

const EXPECTED_MEASURING: Record<string, Record<string, string | null>> = {
    Transit: {
        "Commercial Airport": null,
        "High-Speed Train Line": "highspeed-measure-shinkansen",
        "Rail Station": "rail-measure",
    },
    Borders: {
        "International Border": null,
        "Bundesland border": "admin-measure/4",
        "Gemeindebezirk border": "admin-measure/9",
    },
    Natural: {
        "Sea Level": "sea-level",
        "Body of Water": "water",
        Coastline: null,
        Mountain: "peak-full",
        Park: "park-full",
    },
    "Places of Interest": EXPECTED_MATCHING["Places of Interest"],
    "Public Utilities": EXPECTED_MATCHING["Public Utilities"],
};

const describeCard = (card: DeckCard) =>
    card.noAnswer
        ? null
        : card.adminLevel !== undefined
          ? `${card.type}/${card.adminLevel}`
          : card.type!;

const asTable = (deck: DeckCard[]) =>
    Object.fromEntries(
        deckGroups(deck).map(({ group, cards }) => [
            group,
            Object.fromEntries(
                cards.map((card) => [card.label, describeCard(card)]),
            ),
        ]),
    );

describe.each([
    ["matching", MATCHING_DECK, EXPECTED_MATCHING, matchingCardFor],
    ["measuring", MEASURING_DECK, EXPECTED_MEASURING, measuringCardFor],
] as const)("Small deck: %s", (id, deck, expected, cardFor) => {
    it("has the 20 cards of the rule book, in its groups and order", () => {
        expect(deck).toHaveLength(20);
        expect(asTable(deck)).toEqual(expected);
        expect(Object.keys(asTable(deck))).toEqual(Object.keys(expected));
    });

    it("has unique ids and never repeats a question", () => {
        expect(new Set(deck.map((card) => card.id)).size).toBe(deck.length);
        const answerable = deck.filter((card) => !card.noAnswer);
        const questions = answerable.map(describeCard);
        expect(new Set(questions).size).toBe(questions.length);
    });

    it("creates valid questions that map back to their card", () => {
        for (const card of deck.filter((c) => !c.noAnswer)) {
            const question = questionSchema.parse({
                id,
                data: { lat: 48.2, lng: 16.37, ...cardQuestionData(card) },
            });
            expect(question.id).toBe(id);
            expect(cardFor(question.data as any)).toBe(card);
        }
    });

    it("explains every card without an answer in Vienna", () => {
        for (const card of deck.filter((c) => !c.type)) {
            expect(card.noAnswer).toBeTruthy();
        }
    });
});

describe("radar and thermometer cards", () => {
    it("offers the Small radar distances in metric units", () => {
        expect(RADAR_DISTANCES.map((d) => d.label)).toEqual([
            "500 m",
            "1 km",
            "2 km",
            "5 km",
            "10 km",
            "15 km",
            "40 km",
            "80 km",
            "160 km",
        ]);
    });

    it("recognises a radar card whatever unit it was saved in", () => {
        expect(radarDistanceFor({ radius: 0.5, unit: "kilometers" })).toBe(
            RADAR_DISTANCES[0],
        );
        expect(radarDistanceFor({ radius: 2000, unit: "meters" })).toBe(
            RADAR_DISTANCES[2],
        );
        expect(radarDistanceFor({ radius: 7, unit: "kilometers" })).toBe(
            undefined,
        );
    });

    it("offers the Small thermometer distances", () => {
        expect(THERMOMETER_DISTANCES.map((d) => d.kilometers)).toEqual([1, 5]);
    });
});
