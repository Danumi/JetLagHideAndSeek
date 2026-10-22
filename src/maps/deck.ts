import { type Text, tr } from "@/lib/i18n";
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

/**
 * Vienna's names for its administrative divisions. They stay German in both
 * languages on purpose, like the station names on the signs.
 */
export const ADMIN_LEVEL_NAMES: Partial<Record<AdminLevel, string>> = {
    4: "Bundesland",
    9: "Gemeindebezirk",
    10: "Katastralgemeinde",
};

/** Names for the admin level selects; Vienna has no levels 3, 5, 7 and 8. */
export const ADMIN_LEVEL_LABELS: Record<AdminLevel, Text> = {
    2: { en: "Country (OSM level 2)", de: "Staat (OSM-Ebene 2)" },
    3: {
        en: "OSM level 3 (none in Vienna)",
        de: "OSM-Ebene 3 (gibt es in Wien nicht)",
    },
    4: {
        en: "Bundesland: 1st division (OSM level 4)",
        de: "Bundesland: 1. Ebene (OSM-Ebene 4)",
    },
    5: {
        en: "OSM level 5 (none in Vienna)",
        de: "OSM-Ebene 5 (gibt es in Wien nicht)",
    },
    6: { en: "City (OSM level 6)", de: "Stadt (OSM-Ebene 6)" },
    7: {
        en: "OSM level 7 (none in Vienna)",
        de: "OSM-Ebene 7 (gibt es in Wien nicht)",
    },
    8: {
        en: "OSM level 8 (none in Vienna)",
        de: "OSM-Ebene 8 (gibt es in Wien nicht)",
    },
    9: {
        en: "Gemeindebezirk: 2nd division (OSM level 9)",
        de: "Gemeindebezirk: 2. Ebene (OSM-Ebene 9)",
    },
    10: {
        en: "Katastralgemeinde: 3rd division (OSM level 10)",
        de: "Katastralgemeinde: 3. Ebene (OSM-Ebene 10)",
    },
};

/** The options of an admin level select, in this phone's language. */
export const adminLevelOptions = () =>
    Object.fromEntries(
        Object.entries(ADMIN_LEVEL_LABELS).map(([level, label]) => [
            level,
            tr(label),
        ]),
    );

export type DeckCard = {
    id: string;
    label: Text;
    group: Text;
    /** Short explanation of what counts, shown under the card name. */
    hint?: Text;
    /** Question type in this app; missing when there is nothing to ask about. */
    type?: string;
    /** OSM admin level for the administrative division cards. */
    adminLevel?: AdminLevel;
    /** Why the hider can only answer "no answer" in Vienna. */
    noAnswer?: Text;
    /** Station questions work on the hiding zones (U-Bahn stations). */
    needsHidingZones?: boolean;
};

const NO_AIRPORT: Text = {
    en: "Vienna Airport lies outside the city, so there is no commercial airport in the game area.",
    de: "Der Flughafen Wien liegt außerhalb der Stadt, im Spielgebiet gibt es also keinen Verkehrsflughafen.",
};

export const GROUPS = {
    transit: { en: "Transit", de: "Verkehr" },
    admin: { en: "Administrative Divisions", de: "Verwaltungseinheiten" },
    natural: { en: "Natural", de: "Natur" },
    places: { en: "Places of Interest", de: "Interessante Orte" },
    utilities: { en: "Public Utilities", de: "Öffentliche Einrichtungen" },
    borders: { en: "Borders", de: "Grenzen" },
} satisfies Record<string, Text>;

const MOUNTAIN: Omit<DeckCard, "group"> = {
    id: "mountain",
    label: { en: "Mountain", de: "Berg" },
    hint: {
        en: "Every hilltop on the map, like Kahlenberg",
        de: "Jeder Gipfel auf der Karte, etwa der Kahlenberg",
    },
    type: "peak-full",
};

const PARK: Omit<DeckCard, "group"> = {
    id: "park",
    label: { en: "Park", de: "Park" },
    hint: { en: "Every park, even small ones", de: "Jeder Park, auch kleine" },
    type: "park-full",
};

const placeCards = (
    suffix: string,
): { group: Text; cards: Omit<DeckCard, "group">[] }[] => [
    {
        group: GROUPS.places,
        cards: [
            {
                id: "amusement-park",
                label: { en: "Amusement Park", de: "Vergnügungspark" },
                type: `theme_park${suffix}`,
            },
            {
                id: "zoo",
                label: { en: "Zoo", de: "Zoo" },
                type: `zoo${suffix}`,
            },
            {
                id: "aquarium",
                label: { en: "Aquarium", de: "Aquarium" },
                type: `aquarium${suffix}`,
            },
            {
                id: "golf-course",
                label: { en: "Golf Course", de: "Golfplatz" },
                type: `golf_course${suffix}`,
            },
            {
                id: "museum",
                label: { en: "Museum", de: "Museum" },
                type: `museum${suffix}`,
            },
            {
                id: "movie-theater",
                label: { en: "Movie Theater", de: "Kino" },
                type: `cinema${suffix}`,
            },
        ],
    },
    {
        group: GROUPS.utilities,
        cards: [
            {
                id: "hospital",
                label: { en: "Hospital", de: "Krankenhaus" },
                type: `hospital${suffix}`,
            },
            {
                id: "library",
                label: { en: "Library", de: "Bibliothek" },
                type: `library${suffix}`,
            },
            {
                id: "consulate",
                label: {
                    en: "Foreign Consulate",
                    de: "Ausländisches Konsulat",
                },
                type: `consulate${suffix}`,
            },
        ],
    },
];

const flatten = (
    groups: { group: Text; cards: Omit<DeckCard, "group">[] }[],
): DeckCard[] =>
    groups.flatMap(({ group, cards }) =>
        cards.map((card) => ({ ...card, group })),
    );

export const MATCHING_DECK: DeckCard[] = flatten([
    {
        group: GROUPS.transit,
        cards: [
            {
                id: "airport",
                label: { en: "Commercial Airport", de: "Verkehrsflughafen" },
                type: "airport",
                noAnswer: NO_AIRPORT,
            },
            {
                id: "transit-line",
                label: { en: "Transit Line", de: "Öffi-Linie" },
                hint: {
                    en: "Only while riding public transit",
                    de: "Nur während du mit den Öffis fährst",
                },
                type: "same-train-line",
                needsHidingZones: true,
            },
            {
                id: "station-name-length",
                label: {
                    en: "Station Name's Length",
                    de: "Länge des Stationsnamens",
                },
                hint: {
                    en: "Name as on the sign; spaces and hyphens count",
                    de: "Name wie auf dem Schild; Leerzeichen und Bindestriche zählen mit",
                },
                type: "same-length-station",
                needsHidingZones: true,
            },
            {
                id: "street",
                label: { en: "Street or Path", de: "Straße oder Weg" },
                hint: {
                    en: "Any street or footpath, named or not",
                    de: "Jede Straße und jeder Fußweg, mit oder ohne Namen",
                },
                type: "street",
            },
        ],
    },
    {
        group: GROUPS.admin,
        cards: [
            {
                id: "admin-1",
                label: { en: "Bundesland", de: "Bundesland" },
                hint: {
                    en: "1st administrative division",
                    de: "1. Verwaltungsebene",
                },
                type: "zone",
                adminLevel: 4,
            },
            {
                id: "admin-2",
                label: { en: "Gemeindebezirk", de: "Gemeindebezirk" },
                hint: {
                    en: "2nd administrative division: one of the 23 districts",
                    de: "2. Verwaltungsebene: einer der 23 Bezirke",
                },
                type: "zone",
                adminLevel: 9,
            },
            {
                id: "admin-3",
                label: { en: "Katastralgemeinde", de: "Katastralgemeinde" },
                hint: {
                    en: "3rd administrative division: the cadastral communities",
                    de: "3. Verwaltungsebene: die Katastralgemeinden",
                },
                type: "zone",
                adminLevel: 10,
            },
            {
                id: "admin-4",
                label: {
                    en: "4th Administrative Division",
                    de: "4. Verwaltungsebene",
                },
                noAnswer: {
                    en: "Vienna has no fourth administrative division.",
                    de: "Wien hat keine 4. Verwaltungsebene.",
                },
            },
        ],
    },
    {
        group: GROUPS.natural,
        cards: [
            MOUNTAIN,
            {
                id: "landmass",
                label: { en: "Landmass", de: "Landmasse" },
                hint: {
                    en: "River islands like the Donauinsel are their own landmass",
                    de: "Flussinseln wie die Donauinsel sind eine eigene Landmasse",
                },
                type: "landmass",
            },
            PARK,
        ],
    },
    ...placeCards("-full"),
]);

export const MEASURING_DECK: DeckCard[] = flatten([
    {
        group: GROUPS.transit,
        cards: [
            {
                id: "airport",
                label: { en: "Commercial Airport", de: "Verkehrsflughafen" },
                type: "airport",
                noAnswer: NO_AIRPORT,
            },
            {
                id: "high-speed",
                label: {
                    en: "High-Speed Train Line",
                    de: "Schnellfahrstrecke",
                },
                hint: {
                    en: "Railway lines built for high-speed trains",
                    de: "Bahnstrecken, die für Hochgeschwindigkeitszüge gebaut sind",
                },
                type: "highspeed-measure-shinkansen",
            },
            {
                id: "rail-station",
                label: { en: "Rail Station", de: "Bahnhof" },
                hint: {
                    en: "The stations of the hiding zones (U-Bahn)",
                    de: "Die Stationen der Zonen (U-Bahn)",
                },
                type: "rail-measure",
            },
        ],
    },
    {
        group: GROUPS.borders,
        cards: [
            {
                id: "international-border",
                label: { en: "International Border", de: "Staatsgrenze" },
                noAnswer: {
                    en: "No international border runs through Vienna.",
                    de: "Durch Wien verläuft keine Staatsgrenze.",
                },
            },
            {
                id: "admin-1-border",
                label: { en: "Bundesland border", de: "Bundeslandgrenze" },
                hint: {
                    en: "1st administrative division border: the city limits",
                    de: "Grenze der 1. Verwaltungsebene: die Stadtgrenze",
                },
                type: "admin-measure",
                adminLevel: 4,
            },
            {
                id: "admin-2-border",
                label: {
                    en: "Gemeindebezirk border",
                    de: "Gemeindebezirksgrenze",
                },
                hint: {
                    en: "2nd administrative division border",
                    de: "Grenze der 2. Verwaltungsebene",
                },
                type: "admin-measure",
                adminLevel: 9,
            },
        ],
    },
    {
        group: GROUPS.natural,
        cards: [
            {
                id: "sea-level",
                label: { en: "Sea Level", de: "Seehöhe" },
                hint: {
                    en: "Closer means the hider is lower than you",
                    de: "Näher heißt: Der Hider ist tiefer als du",
                },
                type: "sea-level",
            },
            {
                id: "water",
                label: { en: "Body of Water", de: "Gewässer" },
                hint: {
                    en: "Named lakes, ponds, rivers and canals",
                    de: "Benannte Seen, Teiche, Flüsse und Kanäle",
                },
                type: "water",
            },
            {
                id: "coastline",
                label: { en: "Coastline", de: "Küste" },
                noAnswer: {
                    en: "Vienna has no coastline.",
                    de: "Wien hat keine Küste.",
                },
            },
            MOUNTAIN,
            PARK,
        ],
    },
    ...placeCards("-full"),
]);

/** Cards in rule book order, grouped by their category. */
export const deckGroups = <C extends { group: Text }>(deck: C[]) =>
    deck.reduce<{ group: Text; cards: C[] }[]>((groups, card) => {
        const last = groups[groups.length - 1];
        if (last && last.group.en === card.group.en) {
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
            tr(group),
            Object.fromEntries(
                cards
                    .filter((card) => !card.noAnswer)
                    .map((card) => [card.id, tr(card.label)]),
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

export type PhotoCard = { id: string; label: Text; hint: Text };

/**
 * The photo cards of a Small game, in the rule book's order, in our own
 * words. The app can't check a photo: a photo question is only an entry in
 * the question log, with the time the hider has to answer.
 */
export const PHOTO_DECK: PhotoCard[] = [
    {
        id: "building-from-station",
        label: {
            en: "Building seen from a station",
            de: "Gebäude vom Stationseingang aus",
        },
        hint: {
            en: "Stand right outside a station entrance. The whole building with its roof and both sides; its top in the upper third of the photo.",
            de: "Direkt vor einem Stationseingang stehen. Das ganze Gebäude mit Dach und beiden Seiten, die Spitze im oberen Drittel des Fotos.",
        },
    },
    {
        id: "widest-street",
        label: { en: "Widest street", de: "Breiteste Straße" },
        hint: {
            en: "Both sides of the street in the photo.",
            de: "Beide Straßenseiten müssen drauf sein.",
        },
    },
    {
        id: "tree",
        label: { en: "Tree", de: "Baum" },
        hint: {
            en: "The whole tree in the photo.",
            de: "Der ganze Baum muss drauf sein.",
        },
    },
    {
        id: "tallest-in-sight",
        label: {
            en: "Tallest structure in sight",
            de: "Höchstes Bauwerk in Sichtweite",
        },
        hint: {
            en: "The tallest from where you stand, not the tallest in the city. Top and both sides in the photo, the top in the upper third.",
            de: "Das höchste von deinem Standpunkt aus, nicht das höchste der Stadt. Spitze und beide Seiten drauf, die Spitze im oberen Drittel.",
        },
    },
    {
        id: "selfie",
        label: { en: "You (selfie)", de: "Du (Selfie)" },
        hint: {
            en: "Front camera, phone upright, arm stretched out, no zoom.",
            de: "Frontkamera, Handy senkrecht, Arm ausgestreckt, kein Zoom.",
        },
    },
    {
        id: "sky",
        label: { en: "The sky", de: "Der Himmel" },
        hint: {
            en: "Phone flat on the ground, straight up, no zoom.",
            de: "Handy flach auf den Boden, gerade nach oben, kein Zoom.",
        },
    },
];

export const photoCardFor = (id: string) =>
    PHOTO_DECK.find((card) => card.id === id);
