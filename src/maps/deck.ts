import {
    KILOMETERS_PER_MILE,
    type MatchingQuestion,
    type MeasuringQuestion,
    type RadiusQuestion,
} from "@/maps/schema";

/*
 * The question cards of a Small game (https://jetlag.denull.ru/en/rules/questions),
 * mapped to the question types of this app for Vienna. Matching and measuring
 * have 20 cards each, grouped like the rule book. Tentacles are not part of a
 * Small game.
 */

/** OSM admin levels in Vienna: 4 state, 9 districts, 10 cadastral communities. */
export type AdminLevel = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Names for the admin level selects; Vienna has no levels 3, 5, 7 and 8. */
export const ADMIN_LEVEL_LABELS: Record<AdminLevel, string> = {
    2: "Country (OSM level 2)",
    3: "OSM level 3 (none in Vienna)",
    4: "1st division: state (OSM level 4)",
    5: "OSM level 5 (none in Vienna)",
    6: "City (OSM level 6)",
    7: "OSM level 7 (none in Vienna)",
    8: "OSM level 8 (none in Vienna)",
    9: "2nd division: district (OSM level 9)",
    10: "3rd division: cadastral community (OSM level 10)",
};

export type DeckCard = {
    id: string;
    label: string;
    group: string;
    /** Short explanation shown under the card name. */
    hint?: string;
    /** Question type in this app; missing when there is nothing to ask about. */
    type?: string;
    /** OSM admin level for the administrative division cards. */
    adminLevel?: AdminLevel;
    /** Why the hider can only answer "no answer" in Vienna. */
    noAnswer?: string;
    /** Station questions work on the hiding zones (U-Bahn stations). */
    needsHidingZones?: boolean;
};

const NO_AIRPORT =
    "Vienna Airport lies outside the city, so there is no commercial airport in the game area.";

const placeCards = (
    suffix: string,
): { group: string; cards: Omit<DeckCard, "group">[] }[] => [
    {
        group: "Places of Interest",
        cards: [
            {
                id: "amusement-park",
                label: "Amusement Park",
                type: `theme_park${suffix}`,
            },
            { id: "zoo", label: "Zoo", type: `zoo${suffix}` },
            { id: "aquarium", label: "Aquarium", type: `aquarium${suffix}` },
            {
                id: "golf-course",
                label: "Golf Course",
                type: `golf_course${suffix}`,
            },
            { id: "museum", label: "Museum", type: `museum${suffix}` },
            {
                id: "movie-theater",
                label: "Movie Theater",
                type: `cinema${suffix}`,
            },
        ],
    },
    {
        group: "Public Utilities",
        cards: [
            { id: "hospital", label: "Hospital", type: `hospital${suffix}` },
            { id: "library", label: "Library", type: `library${suffix}` },
            {
                id: "consulate",
                label: "Foreign Consulate",
                type: `consulate${suffix}`,
            },
        ],
    },
];

const flatten = (
    groups: { group: string; cards: Omit<DeckCard, "group">[] }[],
): DeckCard[] =>
    groups.flatMap(({ group, cards }) =>
        cards.map((card) => ({ ...card, group })),
    );

export const MATCHING_DECK: DeckCard[] = flatten([
    {
        group: "Transit",
        cards: [
            {
                id: "airport",
                label: "Commercial Airport",
                type: "airport",
                noAnswer: NO_AIRPORT,
            },
            {
                id: "transit-line",
                label: "Transit Line",
                hint: "Only while riding public transit",
                type: "same-train-line",
                needsHidingZones: true,
            },
            {
                id: "station-name-length",
                label: "Station Name's Length",
                hint: "Name as on the sign",
                type: "same-length-station",
                needsHidingZones: true,
            },
            { id: "street", label: "Street or Path", type: "street" },
        ],
    },
    {
        group: "Administrative Divisions",
        cards: [
            {
                id: "admin-1",
                label: "1st Administrative Division",
                hint: "State",
                type: "zone",
                adminLevel: 4,
            },
            {
                id: "admin-2",
                label: "2nd Administrative Division",
                hint: "District",
                type: "zone",
                adminLevel: 9,
            },
            {
                id: "admin-3",
                label: "3rd Administrative Division",
                hint: "Cadastral community",
                type: "zone",
                adminLevel: 10,
            },
            {
                id: "admin-4",
                label: "4th Administrative Division",
                noAnswer: "Vienna has no fourth administrative division.",
            },
        ],
    },
    {
        group: "Natural",
        cards: [
            { id: "mountain", label: "Mountain", type: "peak-full" },
            { id: "landmass", label: "Landmass", type: "landmass" },
            { id: "park", label: "Park", type: "park-full" },
        ],
    },
    ...placeCards("-full"),
]);

export const MEASURING_DECK: DeckCard[] = flatten([
    {
        group: "Transit",
        cards: [
            {
                id: "airport",
                label: "Commercial Airport",
                type: "airport",
                noAnswer: NO_AIRPORT,
            },
            {
                id: "high-speed",
                label: "High-Speed Train Line",
                type: "highspeed-measure-shinkansen",
            },
            {
                id: "rail-station",
                label: "Rail Station",
                type: "rail-measure",
                needsHidingZones: true,
            },
        ],
    },
    {
        group: "Borders",
        cards: [
            {
                id: "international-border",
                label: "International Border",
                noAnswer: "No international border runs through Vienna.",
            },
            {
                id: "admin-1-border",
                label: "1st Administrative Division Border",
                hint: "State border",
                type: "admin-measure",
                adminLevel: 4,
            },
            {
                id: "admin-2-border",
                label: "2nd Administrative Division Border",
                hint: "District border",
                type: "admin-measure",
                adminLevel: 9,
            },
        ],
    },
    {
        group: "Natural",
        cards: [
            { id: "sea-level", label: "Sea Level", type: "sea-level" },
            { id: "water", label: "Body of Water", type: "water" },
            {
                id: "coastline",
                label: "Coastline",
                noAnswer: "Vienna has no coastline.",
            },
            { id: "mountain", label: "Mountain", type: "peak-full" },
            { id: "park", label: "Park", type: "park-full" },
        ],
    },
    ...placeCards("-full"),
]);

/** Cards in rule book order, grouped by their category. */
export const deckGroups = (deck: DeckCard[]) =>
    deck.reduce<{ group: string; cards: DeckCard[] }[]>((groups, card) => {
        const last = groups[groups.length - 1];
        if (last && last.group === card.group) {
            last.cards.push(card);
        } else {
            groups.push({ group: card.group, cards: [card] });
        }
        return groups;
    }, []);

/** Options for a question card's select: every card that has an answer. */
export const deckSelectGroups = (deck: DeckCard[]) =>
    Object.fromEntries(
        deckGroups(deck).map(({ group, cards }) => [
            group,
            Object.fromEntries(
                cards
                    .filter((card) => !card.noAnswer)
                    .map((card) => [card.id, card.label]),
            ),
        ]),
    );

const adminLevelOf = (question: { type: string; cat?: unknown }) => {
    const level = (question.cat as { adminLevel?: AdminLevel } | undefined)
        ?.adminLevel;
    // Measuring questions about borders default to the state border
    return level ?? (question.type === "admin-measure" ? 4 : undefined);
};

const cardFor = (deck: DeckCard[], question: { type: string; cat?: unknown }) =>
    deck.find(
        (card) =>
            card.type === question.type &&
            (card.adminLevel === undefined ||
                card.adminLevel === adminLevelOf(question)),
    );

export const matchingCardFor = (question: MatchingQuestion) =>
    cardFor(MATCHING_DECK, question);

export const measuringCardFor = (question: MeasuringQuestion) =>
    cardFor(MEASURING_DECK, question);

/** The fields a new question needs to match this card. */
export const cardQuestionData = (card: DeckCard) => ({
    type: card.type!,
    ...(card.adminLevel !== undefined && {
        cat: { adminLevel: card.adminLevel },
    }),
});

export const RADAR_DISTANCES = [
    { label: "500 m", radius: 500, unit: "meters" },
    { label: "1 km", radius: 1, unit: "kilometers" },
    { label: "2 km", radius: 2, unit: "kilometers" },
    { label: "5 km", radius: 5, unit: "kilometers" },
    { label: "10 km", radius: 10, unit: "kilometers" },
    { label: "15 km", radius: 15, unit: "kilometers" },
    { label: "40 km", radius: 40, unit: "kilometers" },
    { label: "80 km", radius: 80, unit: "kilometers" },
    { label: "160 km", radius: 160, unit: "kilometers" },
] as const;

export type RadarDistance = (typeof RADAR_DISTANCES)[number];

const toKilometers = (radius: number, unit: RadiusQuestion["unit"]) =>
    unit === "meters"
        ? radius / 1000
        : unit === "miles"
          ? radius * KILOMETERS_PER_MILE
          : radius;

/** The radar card a question was asked with, if it is one of the Small cards. */
export const radarDistanceFor = (question: {
    radius: number;
    unit: RadiusQuestion["unit"];
}) =>
    RADAR_DISTANCES.find(
        (distance) =>
            Math.abs(
                toKilometers(distance.radius, distance.unit) -
                    toKilometers(question.radius, question.unit),
            ) < 0.001,
    );

export const THERMOMETER_DISTANCES = [
    { label: "1 km", kilometers: 1 },
    { label: "5 km", kilometers: 5 },
] as const;
