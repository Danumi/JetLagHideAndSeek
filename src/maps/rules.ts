import type { HiderInboxEntry } from "@/lib/context";
import type { Text } from "@/lib/i18n";
import {
    type DeckCard,
    deckGroups,
    MATCHING_DECK,
    matchingCardFor,
    MEASURING_DECK,
    measuringCardFor,
    PHOTO_DECK,
} from "@/maps/deck";
import type { Question } from "@/maps/schema";

/*
 * The rules of Hide and Seek for our Small games in Vienna, in our own words
 * (the rule book's wording belongs to Jet Lag: The Game, the app is public):
 * our house rules first, then the rule book's order. Every card of the deck
 * has an entry that says what it asks and what counts, with a note only where
 * Vienna or the app is different; the "?" on a question opens its entry.
 * Where the rule book differs by game size, Small comes first and Medium and
 * Large follow in brackets.
 *
 * **Bold** marks words to stress. A name in braces, like {ask}, becomes the
 * name of that button in the app's language (HelpDialog.tsx), since the
 * help can be German while the app is English.
 */

/** A paragraph, or a list of points. */
export type RuleBlock = Text | { list: Text[] };

/** One card or one rule to look up, folded away until tapped. */
export type RuleEntry = { id: string; title: Text; blocks: RuleBlock[] };

export type RuleSection = {
    id: string;
    title: Text;
    blocks: RuleBlock[];
    groups?: { title?: Text; entries: RuleEntry[] }[];
};

const NO_ANSWER_THEN: Text = {
    de: "Der Hider antwortet „keine Antwort“; die Frage gilt als gestellt, und er zieht trotzdem Karten.",
    en: "The hider answers “no answer”; the question counts as asked, and they still draw cards.",
};

type CardRule = {
    /** The question as the seekers ask it, for each deck the card is in. */
    matching?: Text;
    measuring?: Text;
    /** What counts, as the rule book means it and as the app does it. */
    counts?: Text;
    /** Only where Vienna or the app is different: a short note. */
    note?: Text;
};

const placeCounts = (de: string, en: string): Text => ({
    de: `Alles mit Namen, was in OpenStreetMap als ${de} eingetragen ist, so wie es die App zeigt. Gemessen wird zum Punkt des Orts, nicht zu seinem Rand.`,
    en: `Anything with a name mapped as ${en} in OpenStreetMap, as the app shows it. Distances go to the place's point, not to its edge.`,
});

/** Keyed by the card's id in deck.ts; cards in both decks share one entry. */
const CARD_RULES: Record<string, CardRule> = {
    airport: {
        matching: {
            de: "Ist dein nächster Verkehrsflughafen derselbe wie meiner?",
            en: "Is your nearest commercial airport the same as mine?",
        },
        measuring: {
            de: "Im Vergleich zu mir: Bist du näher an einem Verkehrsflughafen oder weiter weg?",
            en: "Compared to me, are you closer to or further from a commercial airport?",
        },
        counts: {
            de: "Ein Flughafen mit Linienflügen; im Zweifel einer, den man in Google Flights findet.",
            en: "An airport with scheduled flights; when in doubt, one you can find in Google Flights.",
        },
    },
    "transit-line": {
        matching: {
            de: "Hält das Verkehrsmittel, in dem wir gerade sitzen, an deiner Station?",
            en: "Will the transit we're riding stop at your station?",
        },
        counts: {
            de: "Nur erlaubt, während die Seeker in den Öffis sitzen. Ja heißt: Ihr Zug, ihre Straßenbahn oder ihr Bus hält an der Station des Hiders. Fährt er dort nur durch, ist die Antwort Nein. Am besten schicken die Seeker einen Screenshot mit allen Halten ihrer Fahrt.",
            en: "Only while the seekers are riding transit. Yes means their train, tram or bus stops at the hider's station. If it passes through without stopping, the answer is no. Best practice: the seekers send a screenshot of all the stops of their ride.",
        },
        note: {
            de: "**In der App:** Wählt auf der Fragekarte die Linie, in der ihr sitzt (U-Bahn, S-Bahn, Straßenbahn oder Bus). Tippt ihr eine Zone an, zeigt die App die Linien ihrer Station.",
            en: "**In the app:** on the question card, choose the line you're riding (U-Bahn, S-Bahn, tram or bus). Tap a zone and the app shows its station's lines.",
        },
    },
    "station-name-length": {
        matching: {
            de: "Ist der Name deiner Station gleich lang wie der Name meiner nächsten Station?",
            en: "Is your station's name the same length as the name of my nearest station?",
        },
        counts: {
            de: "Gezählt werden alle Zeichen des Namens, Leerzeichen und Bindestriche mit. Bei uns gilt der deutsche Name wie auf dem Schild. Der Hider sagt nur gleich lang oder nicht gleich lang, nicht kürzer oder länger.",
            en: "Every character of the name counts, spaces and hyphens included. We use the German name as on the sign. The hider only says same length or not, not shorter or longer.",
        },
    },
    street: {
        matching: {
            de: "Ist die Straße oder der Weg, auf dem du bist, derselbe wie meiner?",
            en: "Is the street or path you're on the same as mine?",
        },
        counts: {
            de: "Jede Straße und jeder Fußweg auf der Karte. Eine Straße endet dort, wo sie anders heißt. Ein Weg ohne Namen reicht von einer Kreuzung zur nächsten.",
            en: "Any street or footpath on the map. A street ends where its name changes. A path without a name runs from one intersection to the next.",
        },
    },
    "admin-1": {
        matching: {
            de: "Ist dein Bundesland dasselbe wie meines?",
            en: "Is your Bundesland the same as mine?",
        },
        counts: {
            de: "Die 1. Verwaltungsebene, die größte Einteilung eines Landes (in den USA die Bundesstaaten). In Österreich sind das die Bundesländer.",
            en: "The 1st administrative division, the largest division of a country (states in the US). In Austria, the Bundesländer.",
        },
        note: {
            de: "**In Wien:** Das ganze Spielgebiet ist Wien. Die Antwort ist also immer Ja, die Frage bringt nichts.",
            en: "**In Vienna:** The whole game area is Vienna. The answer is always yes, so the question tells you nothing.",
        },
    },
    "admin-2": {
        matching: {
            de: "Ist dein Gemeindebezirk derselbe wie meiner?",
            en: "Is your Gemeindebezirk the same as mine?",
        },
        counts: {
            de: "Die 2. Verwaltungsebene. In Wien sind das die 23 Gemeindebezirke.",
            en: "The 2nd administrative division. In Vienna, the 23 districts (Gemeindebezirke).",
        },
    },
    "admin-3": {
        matching: {
            de: "Ist deine Katastralgemeinde dieselbe wie meine?",
            en: "Is your Katastralgemeinde the same as mine?",
        },
        counts: {
            de: "Die 3. Verwaltungsebene. In Wien sind das die 89 Katastralgemeinden, die alten Grundbuch-Gemeinden, meist frühere Dörfer und Vorstädte. In OpenStreetMap heißen sie „Katastralgemeinde …“.",
            en: "The 3rd administrative division. In Vienna, the 89 cadastral communities (Katastralgemeinden), the old land register communities, mostly former villages and suburbs. OpenStreetMap calls them “Katastralgemeinde …”.",
        },
    },
    "admin-4": {
        matching: {
            de: "Ist deine 4. Verwaltungsebene dieselbe wie meine?",
            en: "Is your 4th administrative division the same as mine?",
        },
        counts: {
            de: "Eine noch feinere Einteilung, die manche großen Städte haben.",
            en: "An even finer division that some large cities have.",
        },
    },
    mountain: {
        matching: {
            de: "Ist dein nächster Berg derselbe wie meiner?",
            en: "Is your nearest mountain the same as mine?",
        },
        measuring: {
            de: "Im Vergleich zu mir: Bist du näher an einem Berg oder weiter weg?",
            en: "Compared to me, are you closer to or further from a mountain?",
        },
        counts: {
            de: "Das Rulebook nimmt, was die Karten-App als Berg zeigt. Bei uns zählen Gipfel mit Namen ab 400 m Seehöhe, niedrigere Hügel nicht. Gemessen wird zum Gipfelpunkt.",
            en: "The rule book takes whatever the map app shows as a mountain. For us, named peaks of at least 400 m count, lower hills don't. Distances go to the summit's point.",
        },
    },
    landmass: {
        matching: {
            de: "Ist deine Landmasse dieselbe wie meine?",
            en: "Is your landmass the same as mine?",
        },
        counts: {
            de: "Eine Landmasse ist zusammenhängendes Land, das kein Gewässer durchtrennt. Liegt die Insel des Hiders ganz innerhalb der Landmasse der Seeker, etwa in einem See, zählt das als dieselbe.",
            en: "A landmass is land in one piece, not cut by water. If the hider's island lies entirely within the seekers' landmass, like an island in a lake, it counts as the same.",
        },
        note: {
            de: "**In Wien:** Donau, Neue Donau und Donaukanal teilen Wien in vier Landmassen: den 2. und 20. Bezirk zwischen Donaukanal und Donau, die Donauinsel, den 21. und 22. Bezirk nördlich der Neuen Donau und alle anderen Bezirke. Sie berühren sich nur außerhalb der Stadt, und außerhalb des Spielgebiets gibt es nichts. Gänsehäufel und Rohrinsel liegen in der Alten Donau und gehören zum 22. Bezirk. **Hausregel:** Wer auf einer Brücke oder auf dem Wasser ist, zählt zum näheren Ufer.",
            en: "**In Vienna:** the Donau, the Neue Donau and the Donaukanal split Vienna into four landmasses: the 2nd and 20th district between the Donaukanal and the Donau, the Donauinsel, the 21st and 22nd district north of the Neue Donau, and all other districts. They only meet outside the city, and outside the game area there is nothing. Gänsehäufel and Rohrinsel lie in the Alte Donau and belong to the 22nd district. **House rule:** on a bridge or on the water, the nearer shore counts.",
        },
    },
    park: {
        matching: {
            de: "Ist dein nächster Park derselbe wie meiner?",
            en: "Is your nearest park the same as mine?",
        },
        measuring: {
            de: "Im Vergleich zu mir: Bist du näher an einem Park oder weiter weg?",
            en: "Compared to me, are you closer to or further from a park?",
        },
        counts: {
            de: "Jeder Park mit Namen, der in OpenStreetMap als Park eingetragen ist, so wie es die App zeigt; Grünflächen ohne Namen zählen nicht. Gemessen wird zum Punkt des Parks, nicht zu seinem Rand. Das wirkt manchmal seltsam: Wer am Rand eines großen Parks steht, ist vielleicht näher am Punkt eines kleinen Parks daneben. Das Rulebook bleibt trotzdem bei dieser Regel, weil sie eindeutig ist.",
            en: "Any park with a name mapped as a park in OpenStreetMap, as the app shows it; green spaces without a name don't count. Distances go to the park's point, not to its edge. That can feel odd: at the edge of a big park, the point of a small park nearby may be closer. The rule book sticks with this rule anyway, because it's clear-cut.",
        },
    },
    "amusement-park": {
        matching: {
            de: "Ist dein nächster Vergnügungspark derselbe wie meiner?",
            en: "Is your nearest amusement park the same as mine?",
        },
        measuring: {
            de: "Im Vergleich zu mir: Bist du näher an einem Vergnügungspark oder weiter weg?",
            en: "Compared to me, are you closer to or further from an amusement park?",
        },
        counts: placeCounts("Vergnügungspark", "an amusement park"),
    },
    zoo: {
        matching: {
            de: "Ist dein nächster Zoo derselbe wie meiner?",
            en: "Is your nearest zoo the same as mine?",
        },
        measuring: {
            de: "Im Vergleich zu mir: Bist du näher an einem Zoo oder weiter weg?",
            en: "Compared to me, are you closer to or further from a zoo?",
        },
        counts: placeCounts("Zoo", "a zoo"),
    },
    aquarium: {
        matching: {
            de: "Ist dein nächstes Aquarium dasselbe wie meines?",
            en: "Is your nearest aquarium the same as mine?",
        },
        measuring: {
            de: "Im Vergleich zu mir: Bist du näher an einem Aquarium oder weiter weg?",
            en: "Compared to me, are you closer to or further from an aquarium?",
        },
        counts: placeCounts("Aquarium", "an aquarium"),
    },
    "golf-course": {
        matching: {
            de: "Ist dein nächster Golfplatz derselbe wie meiner?",
            en: "Is your nearest golf course the same as mine?",
        },
        measuring: {
            de: "Im Vergleich zu mir: Bist du näher an einem Golfplatz oder weiter weg?",
            en: "Compared to me, are you closer to or further from a golf course?",
        },
        counts: {
            de: "Nur echte Golfplätze im Freien; Minigolf und reine Abschlagplätze (Driving Ranges) zählen nicht. Die Seeker sagen beim Fragen am besten dazu, was sie meinen. Gemessen wird zum Punkt des Platzes.",
            en: "Only real outdoor golf courses; mini golf and driving ranges don't count. The seekers had better say what they mean when asking. Distances go to the course's point.",
        },
    },
    museum: {
        matching: {
            de: "Ist dein nächstes Museum dasselbe wie meines?",
            en: "Is your nearest museum the same as mine?",
        },
        measuring: {
            de: "Im Vergleich zu mir: Bist du näher an einem Museum oder weiter weg?",
            en: "Compared to me, are you closer to or further from a museum?",
        },
        counts: placeCounts("Museum", "a museum"),
    },
    "movie-theater": {
        matching: {
            de: "Ist dein nächstes Kino dasselbe wie meines?",
            en: "Is your nearest movie theater the same as mine?",
        },
        measuring: {
            de: "Im Vergleich zu mir: Bist du näher an einem Kino oder weiter weg?",
            en: "Compared to me, are you closer to or further from a movie theater?",
        },
        counts: placeCounts("Kino", "a cinema"),
    },
    hospital: {
        matching: {
            de: "Ist dein nächstes Krankenhaus dasselbe wie meines?",
            en: "Is your nearest hospital the same as mine?",
        },
        measuring: {
            de: "Im Vergleich zu mir: Bist du näher an einem Krankenhaus oder weiter weg?",
            en: "Compared to me, are you closer to or further from a hospital?",
        },
        counts: placeCounts("Krankenhaus", "a hospital"),
    },
    library: {
        matching: {
            de: "Ist deine nächste Bibliothek dieselbe wie meine?",
            en: "Is your nearest library the same as mine?",
        },
        measuring: {
            de: "Im Vergleich zu mir: Bist du näher an einer Bibliothek oder weiter weg?",
            en: "Compared to me, are you closer to or further from a library?",
        },
        counts: placeCounts("Bibliothek", "a library"),
    },
    consulate: {
        matching: {
            de: "Ist dein nächstes ausländisches Konsulat dasselbe wie meines?",
            en: "Is your nearest foreign consulate the same as mine?",
        },
        measuring: {
            de: "Im Vergleich zu mir: Bist du näher an einem ausländischen Konsulat oder weiter weg?",
            en: "Compared to me, are you closer to or further from a foreign consulate?",
        },
        counts: {
            de: "Alles mit Namen, was in OpenStreetMap als Konsulat eingetragen ist; Botschaften zählen nicht. Laut Rulebook zählen auch Honorarkonsulate nicht. Die App unterscheidet sie nicht, im Zweifel klären das die Seeker beim Fragen.",
            en: "Anything with a name mapped as a consulate in OpenStreetMap; embassies don't count. By the rule book, honorary consulates don't count either. The app doesn't tell them apart, so when in doubt the seekers clarify when asking.",
        },
    },
    "rail-station": {
        measuring: {
            de: "Im Vergleich zu mir: Bist du näher an einer Bahnstation oder weiter weg?",
            en: "Compared to me, are you closer to or further from a rail station?",
        },
        counts: {
            de: "Im Rulebook zählen alle Bahnstationen, U-Bahn eingeschlossen. In der App zählen die U-Bahn-Stationen, also die Stationen der Zonen: Verglichen wird der Abstand des Hiders zu seiner nächsten U-Bahn-Station mit dem der Seeker zu ihrer.",
            en: "In the rule book, every rail station counts, metro included. In the app, the U-Bahn stations count, the stations of the zones: it compares the hider's distance to their nearest U-Bahn station with the seekers' distance to theirs.",
        },
    },
    "international-border": {
        measuring: {
            de: "Im Vergleich zu mir: Bist du näher an einer Staatsgrenze oder weiter weg?",
            en: "Compared to me, are you closer to or further from an international border?",
        },
        counts: {
            de: "Jede Grenze zwischen zwei Staaten; Enklaven zählen mit.",
            en: "Any border between two countries; enclaves count.",
        },
    },
    "admin-1-border": {
        measuring: {
            de: "Im Vergleich zu mir: Bist du näher an einer Bundeslandgrenze oder weiter weg?",
            en: "Compared to me, are you closer to or further from a Bundesland border?",
        },
        counts: {
            de: "Die Grenze der 1. Verwaltungsebene, in Österreich zwischen zwei Bundesländern.",
            en: "The border of the 1st administrative division, in Austria between two Bundesländer.",
        },
        note: {
            de: "**In Wien:** Wien ist ganz von Niederösterreich umgeben, gemeint ist also die Stadtgrenze.",
            en: "**In Vienna:** Vienna is surrounded by Lower Austria, so this means the city limits.",
        },
    },
    "admin-2-border": {
        measuring: {
            de: "Im Vergleich zu mir: Bist du näher an einer Gemeindebezirksgrenze oder weiter weg?",
            en: "Compared to me, are you closer to or further from a Gemeindebezirk border?",
        },
        counts: {
            de: "Die Grenze der 2. Verwaltungsebene, in Wien die Grenze eines Gemeindebezirks, auch dort, wo sie die Stadtgrenze ist. Es zählt die nächste Bezirksgrenze, egal von welchem Bezirk, für Seeker und Hider.",
            en: "The border of the 2nd administrative division, in Vienna the border of a district, also where it is the city limit. The nearest district border counts, whichever district it belongs to, for seekers and hider alike.",
        },
    },
    "sea-level": {
        measuring: {
            de: "Im Vergleich zu mir: Bist du näher an der Meereshöhe oder weiter weg?",
            en: "Compared to me, are you closer to or further from sea level?",
        },
        counts: {
            de: "Es geht um die Seehöhe, also wie hoch man steht. Näher heißt: Der Hider steht tiefer als die Seeker. Bei uns zählt der Boden am Standort, nicht das Stockwerk, der Turm oder der Bahnsteig unter der Erde. Die App nimmt die Höhe aus Geländedaten; der Höhenmesser im Handy liegt manchmal daneben.",
            en: "It's about altitude, how high up you are. Closer means the hider is lower than the seekers. For us, the ground where you are counts, not the floor, the tower or the platform underground. The app takes the altitude from terrain data; a phone's altimeter is sometimes off.",
        },
    },
    water: {
        measuring: {
            de: "Im Vergleich zu mir: Bist du näher an einem Gewässer oder weiter weg?",
            en: "Compared to me, are you closer to or further from a body of water?",
        },
        counts: {
            de: "Jedes Gewässer mit Namen auf der Karte, außer Schwimmbecken. Bei uns: benannte Seen, Teiche, Flüsse und Kanäle. Abschnitte unter der Erde zählen nicht. Wer über dem Wasser ist, etwa auf einer Brücke oder einem Steg, ist 0 m davon entfernt.",
            en: "Any named body of water on the map, except pools. For us: named lakes, ponds, rivers and canals. Sections underground don't count. Whoever is over the water, like on a bridge or a pier, is 0 m away from it.",
        },
    },
    coastline: {
        measuring: {
            de: "Im Vergleich zu mir: Bist du näher an einer Küste oder weiter weg?",
            en: "Compared to me, are you closer to or further from a coastline?",
        },
        counts: {
            de: "Küste ist, wo Land auf das Meer trifft, auf einen der großen Seen Nordamerikas oder auf ein Gewässer, das über einen mindestens 1,6 km breiten Wasserweg dorthin fließt.",
            en: "A coastline is where land meets the ocean, one of the Great Lakes, or water flowing into them through a waterway at least 1 mile wide.",
        },
    },
};

/** Extra lines for a photo card, after what its photo must show. */
const PHOTO_RULES: Record<string, Text> = {
    "building-from-station": {
        de: "Gibt es mehrere Eingänge oder Gebäude, sucht sich der Hider eines aus.",
        en: "If there are several entrances or buildings, the hider picks one.",
    },
    "widest-street": {
        de: "Der Hintergrund muss nicht drauf sein.",
        en: "The background doesn't have to be in it.",
    },
};

/** The entry of a card of a deck: the question, what counts, a note. */
const cardEntry = (
    deck: "matching" | "measuring",
    card: DeckCard,
): RuleEntry => {
    const rule = CARD_RULES[card.id] ?? {};
    const question = rule[deck];
    return {
        id: `${deck}-${card.id}`,
        title: card.label,
        blocks: [
            ...(question
                ? [{ de: `„${question.de}“`, en: `“${question.en}”` }]
                : []),
            ...(rule.counts ? [rule.counts] : []),
            ...(card.noAnswer
                ? [
                      {
                          de: `**In Wien:** ${card.noAnswer.de} ${NO_ANSWER_THEN.de}`,
                          en: `**In Vienna:** ${card.noAnswer.en} ${NO_ANSWER_THEN.en}`,
                      },
                  ]
                : rule.note
                  ? [rule.note]
                  : []),
        ],
    };
};

const deckEntries = (deck: "matching" | "measuring") =>
    deckGroups(deck === "matching" ? MATCHING_DECK : MEASURING_DECK).map(
        ({ group, cards }) => ({
            title: group,
            entries: cards.map((card) => cardEntry(deck, card)),
        }),
    );

const curse = (
    id: string,
    name: string,
    de: string,
    effect: Text,
    cost: Text,
    details?: Text,
): RuleEntry => ({
    id: `curse-${id}`,
    title: { de: `${name} (${de})`, en: name },
    blocks: [
        effect,
        { de: `**Preis:** ${cost.de}`, en: `**Cost:** ${cost.en}` },
        ...(details ? [details] : []),
    ],
});

const powerup = (
    id: string,
    name: string,
    de: string,
    count: number,
    text: Text,
): RuleEntry => ({
    id: `powerup-${id}`,
    title: {
        de: `${name} (${de}, ${count}×)`,
        en: `${name} (${count}×)`,
    },
    blocks: [text],
});

export const RULE_SECTIONS: RuleSection[] = [
    {
        id: "house",
        title: { de: "Unsere Hausregeln", en: "Our house rules" },
        blocks: [
            {
                de: "Wir spielen die Größe **Small** in **Wien**. Wo das Rulebook etwas offen lässt oder wir es anders machen, gilt bei uns:",
                en: "We play the **Small** size in **Vienna**. Where the rule book leaves a choice, or we do it differently, this is how we play:",
            },
            {
                list: [
                    {
                        de: "**Spielgebiet:** ganz Wien bis zur Stadtgrenze.",
                        en: "**Game area:** all of Vienna up to the city limits.",
                    },
                    {
                        de: "**Hiding Zones:** nur U-Bahn-Stationen, Radius 500 m (Rulebook: 400 m). Die App zeigt alle 99 Zonen.",
                        en: "**Hiding zones:** U-Bahn stations only, 500 m radius (rule book: 400 m). The app shows all 99 zones.",
                    },
                    {
                        de: "**Versteckphase:** 30 Minuten. Danach zählt die Versteckzeit, bis der Hider gefunden ist; die App misst beides mit {startTimer}.",
                        en: "**Hiding period:** 30 minutes. After that, the hiding time runs until the hider is found; the app times both with {startTimer}.",
                    },
                    {
                        de: "**Antwortzeit:** 5 Minuten, bei Fotos 10 Minuten, ab dem Moment, in dem die Seeker die Frage mit {sendToHider} schicken.",
                        en: "**Time to answer:** 5 minutes, 10 for photos, from the moment the seekers send the question with {sendToHider}.",
                    },
                    {
                        de: "**Fragen:** alle 20 Matching- und 19 Measuring-Fragen (ohne Schnellfahrstrecke), alle Radar-Fragen, die Thermometer 1 km und 5 km und die 6 Foto-Fragen für Small. Keine Tentakel.",
                        en: "**Questions:** all 20 matching and 19 measuring questions (no high-speed train line), every radar, the 1 km and 5 km thermometers and the 6 photo questions for Small. No tentacles.",
                    },
                    {
                        de: "**Alles metrisch:** Radar 500 m, 1, 2, 5, 10, 15, 40, 80 und 160 km, dazu eine frei gewählte Distanz.",
                        en: "**All metric:** radars of 500 m, 1, 2, 5, 10, 15, 40, 80 and 160 km, plus one distance of your choice.",
                    },
                    {
                        de: "**Eine Karte für alle:** Das Rulebook verlangt, dass alle dieselbe Karten-App verwenden. Bei uns ist das diese App mit den Daten von OpenStreetMap. Was als Museum, Park oder Gewässer zählt, zeigt der Ebenen-Knopf auf der Karte.",
                        en: "**One map for everyone:** the rule book wants all players to use the same map app. For us, that's this app with OpenStreetMap data. What counts as a museum, park or body of water, the layers button on the map shows.",
                    },
                    {
                        de: "**Nur Orte mit Namen:** Parks, Museen, Zoos und alle anderen Orte zählen nur, wenn sie einen Namen haben; eine namenlose Grünfläche ist kein Park. Ein Berg ist ein Gipfel mit Namen ab 400 m Seehöhe.",
                        en: "**Named places only:** parks, museums, zoos and every other place count only if they have a name; an unnamed patch of green is no park. A mountain is a named peak of at least 400 m.",
                    },
                    {
                        de: "**Stationsnamen:** der deutsche Name, wie er auf dem Schild steht.",
                        en: "**Station names:** the German name, as on the sign.",
                    },
                    {
                        de: "**Brücken und Wasser:** Wer bei „Landmasse“ auf einer Brücke oder auf dem Wasser ist, zählt zum näheren Ufer. Bei „Gewässer“ ist der Abstand dann 0.",
                        en: "**Bridges and water:** for “Landmass”, whoever is on a bridge or on the water counts to the nearer shore. For “Body of water”, the distance is then 0.",
                    },
                    {
                        de: "**Seehöhe:** Es zählt der Boden an deinem Standort, nicht das Stockwerk, der Turm oder der Bahnsteig unter der Erde. So rechnet die App.",
                        en: "**Sea level:** the ground where you are counts, not the floor, the tower or the platform underground. That's how the app works it out.",
                    },
                    {
                        de: "**Verwaltungsebenen:** 1. Bundesland, 2. Gemeindebezirk, 3. Katastralgemeinde. Eine 4. Ebene gibt es in Wien nicht.",
                        en: "**Administrative divisions:** 1st Bundesland, 2nd Gemeindebezirk, 3rd Katastralgemeinde. Vienna has no 4th.",
                    },
                    {
                        de: "**Live-Standort:** Die Seeker teilen ihren Live-Standort in WhatsApp mit dem Hider. Der Hider teilt seinen nicht.",
                        en: "**Live location:** the seekers share their live location with the hider in WhatsApp. The hider doesn't share theirs.",
                    },
                    {
                        de: "**Fragen und Antworten:** Die Seeker schicken jede Frage mit {sendToHider} in den Chat, der Hider antwortet mit {sendAnswer}, und die Seeker tippen die Antwort in ihrer App ein.",
                        en: "**Questions and answers:** the seekers send each question to the chat with {sendToHider}, the hider answers with {sendAnswer}, and the seekers enter the answer in their app.",
                    },
                ],
            },
        ],
    },
    {
        id: "vienna",
        title: {
            de: "Was in Wien besonders ist",
            en: "What's special in Vienna",
        },
        blocks: [
            {
                list: [
                    {
                        de: "**Keine Antwort** gibt es bei Verkehrsflughafen (der Flughafen Wien liegt außerhalb der Stadt), 4. Verwaltungsebene, Staatsgrenze und Küste. Der Hider sagt dann „keine Antwort“; die Frage gilt als gestellt, und er zieht trotzdem Karten.",
                        en: "**No answer** for commercial airport (Vienna Airport lies outside the city), 4th administrative division, international border and coastline. The hider says “no answer”; the question counts as asked, and they still draw cards.",
                    },
                    {
                        de: "**Bundesland:** Im Spielgebiet ist alles Wien, die Matching-Frage ist also immer Ja. Die Measuring-Frage misst zur Stadtgrenze.",
                        en: "**Bundesland:** everything in the game area is Vienna, so the matching question is always yes. The measuring question measures to the city limits.",
                    },
                    {
                        de: "**Schnellfahrstrecke:** Wien hat nur die Neue Westbahn am Stadtrand, deshalb ist die Karte bei uns nicht im Spiel.",
                        en: "**High-speed train line:** Vienna only has the Neue Westbahn at the edge of the city, so this card isn't in our game.",
                    },
                    {
                        de: "**Gemeindebezirk oder Katastralgemeinde?** Wien hat 23 Gemeindebezirke und 89 Katastralgemeinden. In den inneren Bezirken ist der Bezirk meist genau eine Katastralgemeinde, weiter draußen besteht er aus mehreren; dort grenzt die Katastralgemeinde stärker ein.",
                        en: "**Gemeindebezirk or Katastralgemeinde?** Vienna has 23 districts and 89 cadastral communities. In the inner districts, a district is usually exactly one Katastralgemeinde; further out it has several, and there the Katastralgemeinde narrows things down more.",
                    },
                    {
                        de: "**Landmasse:** Donau, Neue Donau und Donaukanal teilen Wien in vier Landmassen: 2. und 20. Bezirk, Donauinsel, 21. und 22. Bezirk, alle anderen Bezirke. Gänsehäufel und Rohrinsel in der Alten Donau gehören zum 22. Bezirk.",
                        en: "**Landmass:** the Donau, the Neue Donau and the Donaukanal split Vienna into four landmasses: the 2nd and 20th district, the Donauinsel, the 21st and 22nd district, all other districts. Gänsehäufel and Rohrinsel in the Alte Donau belong to the 22nd district.",
                    },
                    {
                        de: "**Gewässer:** benannte Seen, Teiche, Flüsse und Kanäle. Abschnitte unter der Erde zählen nicht, etwa der Wienfluss unter dem Karlsplatz.",
                        en: "**Bodies of water:** named lakes, ponds, rivers and canals. Sections underground don't count, like the Wien river under Karlsplatz.",
                    },
                ],
            },
        ],
    },
    {
        id: "overview",
        title: { de: "Das Spiel in Kürze", en: "The game in short" },
        blocks: [
            {
                de: "Ein Spieler (oder ein Team) versteckt sich irgendwo im Spielgebiet und kommt dorthin nur zu Fuß und mit den Öffis. Alle anderen suchen gemeinsam als Seeker. Mit Fragen grenzen sie ein, wo der Hider sein kann, und fahren hin.",
                en: "One player (or team) hides somewhere in the game area, getting there only on foot and by public transit. Everyone else seeks together. With questions, the seekers narrow down where the hider can be, and travel there.",
            },
            {
                list: [
                    {
                        de: "Mindestens 2 Spieler, am besten höchstens 4. Bei mehr Leuten bildet ihr Teams, die wie ein Spieler zählen. Teams sind auch sinnvoll, wenn sich jemand allein unwohl fühlen würde.",
                        en: "At least 2 players, ideally no more than 4. With more people, form teams that count as one player. Teams also make sense if someone wouldn't feel comfortable alone.",
                    },
                    {
                        de: "Jede Runde hat einen Hider. Normalerweise gibt es so viele Runden wie Spieler, jeder versteckt sich also einmal.",
                        en: "Each round has one hider. Usually there are as many rounds as players, so everyone hides once.",
                    },
                    {
                        de: "Am Anfang jeder Runde hat der Hider eine Versteckphase, um seine Hiding Zone zu erreichen. Danach bleibt er bis zum Ende der Runde in dieser Zone.",
                        en: "Each round starts with a hiding period for the hider to reach their hiding zone. After that, they stay in that zone until the round ends.",
                    },
                    {
                        de: "Die Seeker sind immer gemeinsam unterwegs und stellen Fragen. Für jede Antwort zieht der Hider Karten, die ihm helfen: Zeitbonus, Powerups und Flüche.",
                        en: "The seekers always travel together and ask questions. For every answer, the hider draws cards that help them: time bonuses, powerups and curses.",
                    },
                    {
                        de: "Wird der Hider gefunden, ist die Runde vorbei und der Nächste versteckt sich.",
                        en: "Once the hider is found, the round is over and the next player hides.",
                    },
                    {
                        de: "Es gewinnt, wer in einer Runde am längsten unentdeckt blieb.",
                        en: "Whoever stayed hidden the longest in a round wins.",
                    },
                ],
            },
        ],
    },
    {
        id: "sizes",
        title: { de: "Small, Medium, Large", en: "Small, Medium, Large" },
        blocks: [
            {
                de: "Das Rulebook kennt drei Spielgrößen. Wir spielen **Small**. Das ändert sich mit der Größe:",
                en: "The rule book has three game sizes. We play **Small**. This is what changes with the size:",
            },
            {
                list: [
                    {
                        de: "**Spielgebiet:** Small ist eine Stadt oder ein Teil einer großen Stadt, mit 30 bis 100 Stationen. Medium ist eine große Stadt mit Umland, 100 bis 500 Stationen. Large ist eine Region oder ein ganzes Land, über 500 Stationen.",
                        en: "**Game area:** Small is a town or part of a big city, with 30 to 100 stations. Medium is a big city with its surroundings, 100 to 500 stations. Large is a region or a whole country, over 500 stations.",
                    },
                    {
                        de: "**Dauer:** Small 4 bis 8 Stunden, Medium etwa ein Tag, Large 2 bis 4 Tage. Spiele über mehrere Tage haben jede Nacht eine Ruhezeit von mindestens 10 Stunden; danach geht es dort weiter, wo alle aufgehört haben.",
                        en: "**Length:** Small 4 to 8 hours, Medium about a day, Large 2 to 4 days. Games over several days have a rest period of at least 10 hours every night; afterwards everyone carries on where they stopped.",
                    },
                    {
                        de: "**Versteckphase:** Small 30 Minuten, Medium 60 Minuten, Large 3 Stunden.",
                        en: "**Hiding period:** Small 30 minutes, Medium 60 minutes, Large 3 hours.",
                    },
                    {
                        de: "**Hiding Zone:** Small und Medium 400 m Radius, Large 800 m. Bei uns 500 m.",
                        en: "**Hiding zone:** Small and Medium 400 m radius, Large 800 m. 500 m for us.",
                    },
                    {
                        de: "**Antwortzeit:** immer 5 Minuten, nur Fotos: Small und Medium 10 Minuten, Large 20 Minuten.",
                        en: "**Time to answer:** always 5 minutes, except photos: Small and Medium 10 minutes, Large 20 minutes.",
                    },
                    {
                        de: "**Fragen:** Matching, Measuring und Radar sind in allen Größen gleich. Thermometer, Fotos und Tentakel werden mit der Größe mehr, siehe dort.",
                        en: "**Questions:** matching, measuring and radar are the same in every size. Thermometers, photos and tentacles grow with the size, see there.",
                    },
                    {
                        de: "**Karten des Hiders:** Zeitbonus und einige Flüche haben je Größe andere Werte. Im Regeltext steht zuerst der Wert für Small, in Klammern Medium und Large.",
                        en: "**The hider's cards:** time bonuses and some curses have different values per size. The rules give the Small value first, Medium and Large in brackets.",
                    },
                ],
            },
        ],
    },
    {
        id: "preparation",
        title: { de: "Vorbereitung", en: "Getting ready" },
        blocks: [
            {
                de: "Vor dem Spiel legt ihr fest, wer mitspielt, die Spielgröße, welche Öffis gelten und die Grenzen des Spielgebiets. Alle verwenden dieselben Grenzen. Gegenden, in denen sich jemand nicht sicher fühlt, nehmt ihr heraus.",
                en: "Before the game, agree on the players, the game size, which transit counts, and the borders of the game area. Everyone uses the same borders. Leave out any area where someone wouldn't feel safe.",
            },
            {
                de: "Jeder braucht diese App: die Seeker zum Fragen, der Hider zum Antworten. Dazu kommen das Hider-Deck für den Hider (gedruckt oder online), der Live-Standort der Seeker und 4 Würfel, 2 für den Hider und 2 für die Seeker; manche Flüche brauchen sie.",
                en: "Everyone needs this app: the seekers to ask, the hider to answer. Add the hider deck for the hider (printed or online), the seekers' live location, and 4 dice, 2 for the hider and 2 for the seekers; some curses need them.",
            },
            {
                de: "**In der App:** Zahnrad oben rechts → {newGame}. Wer sucht, wählt {seeking}, wer sich versteckt, {hiding}. Dabei lädt die App die Kartendaten für das Spiel; das dauert beim ersten Mal ein paar Minuten.",
                en: "**In the app:** gear at the top right → {newGame}. Seekers choose {seeking}, the hider {hiding}. The app then loads the map data for the game, which takes a few minutes the first time.",
            },
            {
                de: "**iPhone:** Habt ihr die App auf dem Home-Bildschirm, öffnen sich Links aus dem Chat trotzdem in Safari, und Safari hat seinen eigenen Speicher, ohne Zone, Uhr und frühere Antworten. Als Hider drückst du deshalb lange auf den Frage-Link, kopierst ihn und tippst in der App auf dem Hider-Bildschirm auf {pasteLink}.",
                en: "**iPhone:** if you have the app on your home screen, links from the chat still open in Safari, and Safari keeps its own data, without your zone, timer and earlier answers. So as the hider, press and hold the question link, copy it, and tap {pasteLink} on the hider screen in the app.",
            },
            {
                de: "Die Reihenfolge der Hider lost ihr vor dem Spiel aus.",
                en: "Draw lots for the order of the hiders before the game.",
            },
        ],
    },
    {
        id: "hiding",
        title: { de: "Verstecken", en: "Hiding" },
        blocks: [
            {
                de: "Jede Runde beginnt mit der **Versteckphase**: 30 Minuten (Medium 60, Large 180). Der Hider fährt oder geht zu irgendeiner Station im Spiel. Die Seeker teilen ihren Live-Standort mit dem Hider, damit er sie die ganze Runde verfolgen kann; der Hider teilt seinen nicht.",
                en: "Each round starts with the **hiding period**: 30 minutes (Medium 60, Large 180). The hider travels or walks to any station in play. The seekers share their live location with the hider so they can follow them all round; the hider doesn't share theirs.",
            },
            {
                de: "Am Ende der Versteckphase muss der Hider an einer Station stehen. Sie ist der Mittelpunkt seiner **Hiding Zone**: ein Kreis mit 500 m Radius (Rulebook: 400 m, Large 800 m). Liegen weitere Stationen in der Zone, gilt trotzdem nur diese eine als seine Station; manche Fragen beziehen sich auf sie.",
                en: "At the end of the hiding period, the hider must be at a station. It becomes the centre of their **hiding zone**: a circle with a 500 m radius (rule book: 400 m, Large 800 m). If other stations lie in the zone, only this one is their station; some questions refer to it.",
            },
            {
                de: "Bis zum Endgame darf sich der Hider in der Zone frei bewegen: einkaufen, essen, spazieren gehen. Verlassen darf er sie bis zum Ende der Runde nicht.",
                en: "Until the endgame, the hider can move freely within the zone: shop, eat, go for a walk. They mustn't leave it until the round is over.",
            },
            {
                de: "**In der App:** Zu Beginn der Versteckphase tippt ihr {startTimer}. Die Uhr steht oben auf dem Hider-Bildschirm und oben links auf der Karte; sie zählt die 30 Minuten herunter und danach die Versteckzeit hoch. Ist die offizielle Zeit schon um oder sind alle einverstanden, stellt {startSeeking} die Versteckphase auf 0. Der Hider wählt seine Zone auf dem Hider-Bildschirm oder tippt sie auf der Karte an und wählt {chooseZone}. Danach zeigt seine Karte nur noch diese Zone; grau bleibt, was die Seeker mit ihren Fragen ausgeschlossen haben, und alle übrigen Zonen stehen unter {zones}. Verlässt er seine Zone, warnt ihn die App.",
                en: "**In the app:** when the hiding period begins, tap {startTimer}. The clock sits at the top of the hider screen and at the top left of the map; it counts down the 30 minutes, then counts up the hiding time. If the official time is up already, or everyone agrees to start, {startSeeking} sets the hiding period to 0. The hider chooses their zone on the hider screen, or taps it on the map and chooses {chooseZone}. From then on their map shows only that zone; the grey is still what the seekers' questions rule out, and all zones left are under {zones}. If they leave their zone, the app warns them.",
            },
            {
                de: "**Tipps für den Hider:** Die Wahl der Zone ist die wichtigste Entscheidung der Runde. Abgelegene Zonen sind schwerer zu erraten, aber haben die Seeker sie einmal eingegrenzt, gibt es dort wenige Stationen. In dichten Gegenden wird es kompliziert, dafür kommen die Seeker schnell überall hin. Manche Foto-Fragen verlangen, schnell an eine bestimmte Stelle der Zone zu kommen; solche Fotos kannst du vorher machen. Und such dir rechtzeitig einen guten Platz für das Endgame.",
                en: "**Tips for the hider:** choosing the zone is the most important decision of the round. Remote zones are harder to guess, but once the seekers have narrowed them down, there are few stations around. Dense areas get complicated, but the seekers get everywhere quickly. Some photo questions need you to reach a certain spot in your zone fast; you can take those photos in advance. And find a good spot for the endgame in time.",
            },
        ],
    },
    {
        id: "asking",
        title: { de: "Fragen stellen", en: "Asking questions" },
        blocks: [
            {
                de: "Die Seeker fragen aus fünf Kategorien: Matching, Measuring, Radar, Thermometer und Fotos; in Medium und Large kommen Tentakel dazu. Eine neue Frage geht erst, wenn die vorige beantwortet ist.",
                en: "The seekers ask from five categories: matching, measuring, radar, thermometer and photos; Medium and Large add tentacles. A new question can only be asked once the previous one is answered.",
            },
            {
                list: [
                    {
                        de: "Der Hider antwortet ehrlich, innerhalb von **5 Minuten**, bei Fotos **10 Minuten** (Large 20). Die Zeit läuft, sobald die Frage gestellt ist, bei uns ab {sendToHider}.",
                        en: "The hider answers truthfully, within **5 minutes**, **10 minutes** for photos (Large 20). The time runs from when the question is asked, for us from {sendToHider}.",
                    },
                    {
                        de: "Zum Antworten darf er das Internet benutzen, aber kein Google Street View oder Ähnliches.",
                        en: "They may use the internet to answer, but not Google Street View or anything like it.",
                    },
                    {
                        de: "Nach jeder Antwort zieht der Hider Karten vom Hider-Deck, wie viele, steht bei jeder Kategorie. Der Hider-Bildschirm sagt es nach dem Antworten.",
                        en: "After each answer, the hider draws cards from the hider deck; how many is given for each category. The hider screen says so after answering.",
                    },
                    {
                        de: "Antwortet er zu spät, bleibt seine Versteckzeit stehen, bis er antwortet, und er bekommt für diese Frage keine Karten. Er muss sich aber ernsthaft bemühen, rechtzeitig zu antworten. In der App hält die Spielzeit-Uhr des Hiders dafür von selbst an, von der Frist bis zum Senden der Antwort. Wer das in den Einstellungen unter „Erweitert“ abschaltet, tippt {pause} und danach {resume}.",
                        en: "If they answer late, their hiding time stops until they answer, and they get no cards for that question. They must make a real effort to answer in time, though. In the app, the hider's game timer stops by itself, from when the answer was due until it's sent. If you turn that off in the settings under “Advanced”, tap {pause}, then {resume}.",
                    },
                    {
                        de: "Jede Frage gibt es nur einmal. Ein zweites Mal geht nur zum doppelten Preis: Der Hider zieht dann zweimal, also etwa zweimal 3 Karten und behält je 1, nicht 6 und behält 2. Beim dritten Mal dreimal, und so weiter.",
                        en: "Each question can be asked once. Asking it again costs double: the hider draws twice, say twice draw 3 keep 1, not draw 6 keep 2. The third time three times, and so on.",
                    },
                    {
                        de: "Was außerhalb des Spielgebiets liegt, gibt es im Spiel nicht. Gibt es deshalb keine Antwort, sagt der Hider „keine Antwort“. Die Frage gilt trotzdem als gestellt, und der Hider zieht Karten.",
                        en: "Anything outside the game area doesn't exist in the game. If that leaves no answer, the hider says “no answer”. The question still counts as asked, and the hider draws cards.",
                    },
                    {
                        de: "Unklarheiten klären die Seeker beim Fragen, zum Beispiel mit einem Screenshot aller Orte, die sie meinen.",
                        en: "The seekers clear up anything unclear when they ask, for example with a screenshot of all the places they mean.",
                    },
                ],
            },
            {
                de: "**Was als Ort zählt:** Das Rulebook rechnet mit den Symbolen in Google Maps. Bei uns zählt, was in OpenStreetMap eingetragen ist und einen Namen hat, so wie es die App zeigt; so schauen Hider und Seeker in dieselbe Karte. Gemessen wird zum Punkt des Orts, nicht zu seinem Rand.",
                en: "**What counts as a place:** the rule book goes by the icons in Google Maps. For us, what's in OpenStreetMap and has a name counts, as the app shows it, so hider and seekers look at the same map. Distances go to the place's point, not to its edge.",
            },
            {
                de: "**In der App:** {ask} → Karte wählen. Die Frage nimmt deinen Standort und zeigt das Nächste, etwa das nächste Museum. Mit {sendToHider} geht sie als Link in den Chat, ab dann läuft die Uhr des Hiders. Kommt die Antwort, tippst du sie auf der Frage ein; erst dann ändert sich die Karte. Fehlt noch eine Antwort, fragt die App vor der nächsten Frage nach, und schon gestellte Karten zeigen, wann ihr sie gefragt habt.",
                en: "**In the app:** {ask} → pick a card. The question takes your location and shows what's nearest, like the nearest museum. {sendToHider} sends it to the chat as a link, and the hider's clock starts. When the answer comes, enter it on the question; only then does the map change. If an answer is still missing, the app checks before the next question, and cards you've asked show when.",
            },
        ],
    },
    {
        id: "matching",
        title: { de: "Matching", en: "Matching" },
        blocks: [
            {
                de: "„Ist dein nächstes ___ dasselbe wie mein nächstes ___?“ Der Hider antwortet **Ja** oder **Nein**, innerhalb von 5 Minuten. Danach zieht er **3 Karten und behält 1**.",
                en: "“Is your nearest ___ the same as my nearest ___?” The hider answers **yes** or **no**, within 5 minutes. Then they **draw 3 cards and keep 1**.",
            },
            {
                de: "Matching hilft in jeder Phase. Oft lohnt es sich, vorher an einen passenden Ort zu fahren. Bei Ja bleibt nur das Gebiet übrig, in dem derselbe Ort am nächsten ist; bei Nein fällt genau dieses Gebiet weg.",
                en: "Matching helps at any stage. It often pays to travel to a good spot first. A yes leaves only the area where the same place is nearest; a no rules out exactly that area.",
            },
        ],
        groups: deckEntries("matching"),
    },
    {
        id: "measuring",
        title: { de: "Measuring", en: "Measuring" },
        blocks: [
            {
                de: "„Im Vergleich zu mir: Bist du näher an ___ oder weiter weg?“ Der Hider antwortet **näher** oder **weiter weg**, innerhalb von 5 Minuten. Danach zieht er **3 Karten und behält 1**.",
                en: "“Compared to me, are you closer to or further from ___?” The hider answers **closer** or **further**, within 5 minutes. Then they **draw 3 cards and keep 1**.",
            },
            {
                de: "Measuring hilft fast immer und teilt die Karte auf ungewohnte Weise. Verglichen wird der Abstand zum jeweils nächsten solchen Ort, beim Hider wie bei den Seekern.",
                en: "Measuring almost always helps and slices the map in unusual ways. It compares the distance to the nearest such place, for the hider and for the seekers.",
            },
        ],
        groups: deckEntries("measuring"),
    },
    {
        id: "radar",
        title: { de: "Radar", en: "Radar" },
        blocks: [
            {
                de: "„Bist du im Umkreis von ___ um mich?“ Der Hider antwortet **Ja** oder **Nein**, innerhalb von 5 Minuten. Danach zieht er **2 Karten und behält 1**.",
                en: "“Are you within ___ of me?” The hider answers **yes** or **no**, within 5 minutes. Then they **draw 2 cards and keep 1**.",
            },
            {
                de: "Es zählt, wo der Hider beim Antworten gerade ist, nicht seine ganze Zone. Ragt der Kreis in seine Zone, reicht aber nicht bis zu ihm, ist die Antwort Nein.",
                en: "What counts is where the hider is when answering, not their whole zone. If the circle reaches into their zone but not to them, the answer is no.",
            },
            {
                de: "**Distanzen bei uns:** 500 m, 1, 2, 5, 10, 15, 40, 80 und 160 km, dazu eine frei gewählte Distanz. Jede gibt es einmal.",
                en: "**Our distances:** 500 m, 1, 2, 5, 10, 15, 40, 80 and 160 km, plus one distance of your choice. Each can be asked once.",
            },
            {
                de: "Gut, um zu prüfen, ob ihr grob richtig liegt, oder um eine dichte Gegend auf einmal zu streichen.",
                en: "Good for checking you're in roughly the right area, or for crossing off a dense part of the map in one go.",
            },
        ],
    },
    {
        id: "thermometer",
        title: { de: "Thermometer", en: "Thermometer" },
        blocks: [
            {
                de: "„Ich bin ___ gefahren: Bin ich jetzt wärmer oder kälter?“ Wärmer heißt: näher am Hider als beim Start. Der Hider antwortet **wärmer** oder **kälter**, innerhalb von 5 Minuten. Danach zieht er **2 Karten und behält 1**.",
                en: "“After traveling ___, am I hotter or colder?” Hotter means closer to the hider than at the start. The hider answers **hotter** or **colder**, within 5 minutes. Then they **draw 2 cards and keep 1**.",
            },
            {
                de: "Am Start sagen die Seeker dem Hider, dass sie ein Thermometer beginnen, und schicken ihren Standort. Dann fahren sie mindestens die Strecke der Karte, gemessen in Luftlinie (bei uns **1 km** oder **5 km**); weiter ist erlaubt, kürzer nicht. Am Ende schicken sie den neuen Standort. Verglichen wird mit dem Ort, an dem der Hider beim Antworten ist.",
                en: "At the start, the seekers tell the hider they're starting a thermometer and send their location. Then they travel at least the card's distance, measured in a straight line (**1 km** or **5 km** for us); further is fine, shorter isn't. At the end, they send their new location. Both are compared with where the hider is when answering.",
            },
            {
                de: "**Strecken je nach Spielgröße:** Small 800 m und 5 km, Medium zusätzlich 16 km, Large zusätzlich 80 km. Bei uns 1 km und 5 km.",
                en: "**Distances by game size:** Small 800 m and 5 km, Medium adds 16 km, Large adds 80 km. 1 km and 5 km for us.",
            },
            {
                de: "**In der App:** {ask} → Thermometer → Start. {tellHider} schickt dem Hider Startzeit und Standort als Kartenlink. Die App misst mit und meldet sich, wenn die Strecke geschafft ist; die Frage zeigt die gefahrene Luftlinie und warnt rot, wenn sie zu kurz ist.",
                en: "**In the app:** {ask} → thermometer → start. {tellHider} sends the hider your start time and location as a map link. The app keeps track and tells you when you've covered the distance; the question shows the straight-line distance traveled and warns in red if it's too short.",
            },
            {
                de: "Gut, um zu sehen, ob ihr in die richtige Richtung fahrt.",
                en: "Good for finding out whether you're heading the right way.",
            },
        ],
    },
    {
        id: "photo",
        title: { de: "Fotos", en: "Photos" },
        blocks: [
            {
                de: "„Schick mir ein Foto von ___.“ Der Hider schickt ein Foto, das die Vorgaben der Karte erfüllt, oder sagt „kann ich nicht beantworten“, wenn es das Motiv in seiner Zone nicht gibt. Er hat **10 Minuten** Zeit (Large 20). Danach zieht er **1 Karte und behält sie**.",
                en: "“Send me a photo of ___.” The hider sends a photo that meets the card's requirements, or says “I can't answer” if their zone has no such subject. They have **10 minutes** (Large 20). Then they **draw 1 card and keep it**.",
            },
            {
                de: "Fotos immer im normalen Seitenverhältnis des Handys. Die Seeker dürfen ein Foto nicht mit Street View aus der Ferne prüfen.",
                en: "Photos always in the phone's normal aspect ratio. The seekers mustn't check a photo from afar with Street View.",
            },
            {
                de: "**In der App:** Foto-Fragen sind nur ein Eintrag mit Uhr, das Foto selbst kommt im Chat.",
                en: "**In the app:** photo questions are just an entry with a clock; the photo itself comes in the chat.",
            },
            {
                de: "**Je nach Spielgröße:** Small hat die 6 Karten unten. Medium und Large haben zusätzlich: höchstes Gebäude vom Stationseingang aus, nächste Straße nachzeichnen, 2 Gebäude, Restaurant von innen, Park, Supermarkt-Regal, Gotteshaus und Bahnsteig. Large hat dazu: 800 m Straßen nachzeichnen, höchster Berg vom Stationseingang aus, größtes Gewässer der Zone und 5 Gebäude.",
                en: "**By game size:** Small has the 6 cards below. Medium and Large add: tallest building from a station entrance, trace the nearest street, 2 buildings, restaurant interior, park, grocery store aisle, place of worship and train platform. Large also adds: trace 800 m of streets, tallest mountain from a station entrance, biggest body of water in the zone and 5 buildings.",
            },
        ],
        groups: [
            {
                entries: PHOTO_DECK.map((card) => ({
                    id: `photo-${card.id}`,
                    title: card.label,
                    blocks: [
                        card.hint,
                        ...(PHOTO_RULES[card.id] ? [PHOTO_RULES[card.id]] : []),
                    ],
                })),
            },
        ],
    },
    {
        id: "tentacles",
        title: {
            de: "Tentakel (nur Medium und Large)",
            en: "Tentacles (Medium and Large only)",
        },
        blocks: [
            {
                de: "„Welches ___ im Umkreis von ___ um mich ist dir am nächsten? (Du musst auch in diesem Umkreis sein.)“ Ist der Hider im Umkreis, nennt er den Ort, der ihm am nächsten ist; sonst sagt er, dass er nicht im Umkreis ist. Er hat 5 Minuten. Danach zieht er **4 Karten und behält 2**.",
                en: "“Which ___ within ___ of me are you nearest to? (You must also be within that distance.)” If the hider is within reach, they name the place nearest to them; otherwise they say they're out of reach. They have 5 minutes. Then they **draw 4 cards and keep 2**.",
            },
            {
                de: "Teuer, aber genau, am besten gegen Ende: Jeder dieser Orte wird zum Fangarm, und einer davon erwischt den Hider.",
                en: "Expensive but precise, best near the end: each of these places becomes a tentacle, and one of them catches the hider.",
            },
            {
                list: [
                    {
                        de: "**Medium:** Museen, Bibliotheken, Kinos und Krankenhäuser, je im Umkreis von 1,6 km.",
                        en: "**Medium:** museums, libraries, cinemas and hospitals, each within 1.6 km.",
                    },
                    {
                        de: "**Large zusätzlich:** U-Bahn-Linien, Zoos, Aquarien und Vergnügungsparks, je im Umkreis von 24 km.",
                        en: "**Large adds:** metro lines, zoos, aquariums and amusement parks, each within 24 km.",
                    },
                ],
            },
            {
                de: "In Small gibt es keine Tentakel, bei uns also auch nicht.",
                en: "Small has no tentacles, so we don't use them.",
            },
        ],
    },
    {
        id: "cards",
        title: { de: "Die Karten des Hiders", en: "The hider's cards" },
        blocks: [
            {
                de: "Das Hider-Deck hat drei Arten von Karten: **Zeitbonus**, **Powerups** und **Flüche**. Nach jeder Antwort zieht der Hider, etwa nach Measuring 3 Karten: eine behält er, die anderen legt er ab. Behaltene Karten bleiben auf der Hand, bis er sie spielt oder ablegt.",
                en: "The hider deck has three kinds of cards: **time bonuses**, **powerups** and **curses**. After each answer, the hider draws, after measuring 3 cards for example: they keep one and discard the rest. Kept cards stay in hand until played or discarded.",
            },
            {
                de: "Auf der Hand dürfen höchstens **6 Karten** sein (mehr nur mit einem Powerup). Sind es mehr, muss der Hider sofort spielen oder ablegen, bis es wieder 6 sind.",
                en: "The hand holds at most **6 cards** (more only with a powerup). With more, the hider must play or discard right away until they're back to 6.",
            },
        ],
        groups: [
            {
                title: { de: "Zeitbonus", en: "Time bonus" },
                entries: [
                    {
                        id: "time-bonus",
                        title: { de: "Zeitbonus", en: "Time bonus" },
                        blocks: [
                            {
                                de: "Zeitbonus-Karten kommen am Ende zur Versteckzeit dazu, aber nur, wenn sie dann noch auf der Hand sind. Spielen kann man sie nicht, nur ablegen, und dann ist der Bonus weg.",
                                en: "Time bonus cards are added to the hiding time at the end, but only if they're still in hand then. They can't be played, only discarded, and then the bonus is gone.",
                            },
                            {
                                de: "Auf jeder Karte stehen drei Werte für Small, Medium und Large; wir nehmen den ersten. Im Deck:",
                                en: "Each card has three values for Small, Medium and Large; we use the first. In the deck:",
                            },
                            {
                                list: [
                                    {
                                        de: "25 × 2 Minuten (Medium 3, Large 5)",
                                        en: "25 × 2 minutes (Medium 3, Large 5)",
                                    },
                                    {
                                        de: "15 × 4 Minuten (Medium 6, Large 10)",
                                        en: "15 × 4 minutes (Medium 6, Large 10)",
                                    },
                                    {
                                        de: "10 × 6 Minuten (Medium 9, Large 15)",
                                        en: "10 × 6 minutes (Medium 9, Large 15)",
                                    },
                                    {
                                        de: "3 × 8 Minuten (Medium 12, Large 20)",
                                        en: "3 × 8 minutes (Medium 12, Large 20)",
                                    },
                                    {
                                        de: "2 × 12 Minuten (Medium 18, Large 30)",
                                        en: "2 × 12 minutes (Medium 18, Large 30)",
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            {
                title: { de: "Powerups", en: "Powerups" },
                entries: [
                    {
                        id: "powerups",
                        title: {
                            de: "Wie Powerups funktionieren",
                            en: "How powerups work",
                        },
                        blocks: [
                            {
                                de: "Der Hider kann ein Powerup jederzeit spielen; danach wird es abgelegt. Den Seekern sagt er es nur, wenn es sie direkt betrifft.",
                                en: "The hider can play a powerup at any time; then it's discarded. They only tell the seekers if it affects them directly.",
                            },
                        ],
                    },
                    powerup("veto", "Veto Question", "Veto", 4, {
                        de: "Statt zu antworten, solange die Antwortzeit läuft. Die Seeker bekommen keine Antwort, nur die Info, dass ein Veto gespielt wurde. Die Frage gilt als gestellt (nochmal nur zum höheren Preis), und der Hider zieht dafür keine Karten.",
                        en: "Instead of answering, while the time to answer runs. The seekers get no answer, only the news that a veto was played. The question counts as asked (again only at the higher cost), and the hider draws no cards for it.",
                    }),
                    powerup(
                        "randomize",
                        "Randomize Question",
                        "Frage tauschen",
                        4,
                        {
                            de: "Statt zu antworten, solange die Antwortzeit läuft. Die Seeker ziehen per Zufall eine andere, noch nicht gestellte Frage derselben Kategorie, aus einem Radar 2 km wird so vielleicht ein Radar 40 km. Die beantwortet der Hider ganz normal. Die ursprüngliche Frage gilt als nicht gestellt. Kommt „keine Antwort“ heraus, ist das erlaubt.",
                            en: "Instead of answering, while the time to answer runs. The seekers pick another unasked question of the same category at random, so a 2 km radar might become a 40 km radar. The hider answers that one as usual. The original question doesn't count as asked. If it leads to “no answer”, that's allowed.",
                        },
                    ),
                    powerup(
                        "draw-2",
                        "Discard 1, Draw 2",
                        "1 ablegen, 2 ziehen",
                        4,
                        {
                            de: "Jederzeit: 1 andere Karte ablegen, dann 2 ziehen und behalten. Ohne Karte zum Ablegen geht es nicht.",
                            en: "Any time: discard 1 other card, then draw and keep 2. Not possible without a card to discard.",
                        },
                    ),
                    powerup(
                        "draw-3",
                        "Discard 2, Draw 3",
                        "2 ablegen, 3 ziehen",
                        4,
                        {
                            de: "Jederzeit: 2 andere Karten ablegen, dann 3 ziehen und behalten. Ohne 2 Karten zum Ablegen geht es nicht.",
                            en: "Any time: discard 2 other cards, then draw and keep 3. Not possible without 2 cards to discard.",
                        },
                    ),
                    powerup(
                        "expand-1",
                        "Draw 1, Expand 1",
                        "1 ziehen, Hand +1",
                        2,
                        {
                            de: "Jederzeit: 1 Karte ziehen. Für den Rest der Runde darf der Hider eine Karte mehr auf der Hand haben, also 7, mit beiden solchen Karten 8.",
                            en: "Any time: draw 1 card. For the rest of the round, the hider may hold one more card, so 7, or 8 with both of these cards.",
                        },
                    ),
                    powerup(
                        "duplicate",
                        "Duplicate Another Card",
                        "Karte kopieren",
                        2,
                        {
                            de: "Zählt als Kopie einer anderen Karte auf der Hand; die Karte selbst bleibt. Ist sie am Ende der Runde noch auf der Hand, kann sie einen Zeitbonus kopieren und ihn so verdoppeln.",
                            en: "Counts as a copy of another card in hand; that card stays. If it's still in hand at the end of the round, it can copy a time bonus and so double it.",
                        },
                    ),
                    powerup("move", "Move", "Umziehen", 1, {
                        de: "Der Hider bekommt Zeit, wie viel steht je nach Spielgröße auf der Karte, um eine neue Zone an einer anderen Station zu beziehen, nur mit erlaubten Öffis. So lange stehen die Seeker still und fragen nicht, und seine Versteckzeit läuft nicht weiter. In der App tippt der Hider auf dem Hider-Bildschirm {moving}, die Seeker in der Fragenliste {hiderMoved}: Die bisherigen Antworten zählen dann auf der Karte nicht mehr, alle Zonen sind wieder da, und die Spielzeit-Uhr pausiert bis {resume}. Beim Spielen legt er sofort alle Karten auf der Hand ab und verrät den Seekern seine bisherige Station. Nicht im Endgame.",
                        en: "The hider gets time, as much as the card gives for the game size, to set up a new zone at another station, using only allowed transit. Meanwhile the seekers stay put and don't ask, and the hiding time doesn't run. In the app, the hider taps {moving} on the hider screen, the seekers {hiderMoved} in the question list: the answers so far stop counting on the map, all zones come back, and the game timer pauses until {resume}. When playing it, the hider discards their whole hand right away and tells the seekers their old station. Not during the endgame.",
                    }),
                ],
            },
            {
                title: { de: "Flüche", en: "Curses" },
                entries: [
                    {
                        id: "curses",
                        title: {
                            de: "Wie Flüche funktionieren",
                            en: "How curses work",
                        },
                        blocks: [
                            {
                                de: "Flüche spielt der Hider gegen die Seeker, um sie aufzuhalten oder zu ärgern. Jeder wirkt einmal und wird danach abgelegt. Jeder hat einen Preis: mal Karten ablegen, mal eine Bedingung, etwa ein Mindestabstand zu den Seekern.",
                                en: "The hider plays curses on the seekers to slow them down or annoy them. Each works once and is then discarded. Each has a cost: sometimes discarding cards, sometimes a condition, like a minimum distance to the seekers.",
                            },
                            {
                                de: "Mehrere Flüche gleichzeitig sind erlaubt, aber nie mehr als einer, der Fragen oder Öffis blockiert. Die Seeker sagen Bescheid, sobald sie einen Fluch erledigt haben. Wo sich die Werte je nach Spielgröße unterscheiden, steht zuerst Small, in Klammern Medium und Large.",
                                en: "Several curses at once are fine, but never more than one that blocks questions or transit. The seekers say when they've cleared a curse. Where values differ by game size, Small comes first, Medium and Large in brackets.",
                            },
                        ],
                    },
                    curse(
                        "luxury-car",
                        "The Luxury Car",
                        "Luxusauto",
                        {
                            de: "Der Hider fotografiert ein Auto. Die Seeker müssen ein teureres Auto fotografieren, bevor sie wieder fragen.",
                            en: "The hider photographs a car. The seekers must photograph a more expensive car before asking again.",
                        },
                        {
                            de: "ein Foto eines Autos.",
                            en: "a photo of a car.",
                        },
                        {
                            de: "Verglichen wird der Neupreis des Modells im Baujahr, ohne Extras. Beide Autos müssen auf dem Foto erkennbar sein; bei Unklarheit einigt ihr euch auf Modell und Jahr.",
                            en: "Compare the model's list price in its year, without extras. Both cars must be recognisable in the photo; if unsure, agree on model and year.",
                        },
                    ),
                    curse(
                        "bridge-troll",
                        "The Bridge Troll",
                        "Brückentroll",
                        {
                            de: "Die Seeker müssen ihre nächste Frage unter einer Brücke stellen, jeder mit einem Teil des Körpers darunter.",
                            en: "The seekers must ask their next question from under a bridge, each with some part of their body under it.",
                        },
                        {
                            de: "Die Seeker sind mindestens 300 m (Medium 1,5 km, Large 9 km) vom Hider entfernt.",
                            en: "the seekers are at least 300 m (Medium 1.5 km, Large 9 km) from the hider.",
                        },
                        {
                            de: "Brücke ist jedes Bauwerk, über das ein Weg, eine Straße oder eine Bahn führt.",
                            en: "A bridge is any structure carrying a path, road or railway.",
                        },
                    ),
                    curse(
                        "drained-brain",
                        "The Drained Brain",
                        "Leeres Hirn",
                        {
                            de: "Der Hider wählt drei Fragen aus drei verschiedenen Kategorien. Die dürfen die Seeker für den Rest der Runde nicht mehr stellen, auch nicht zum höheren Preis.",
                            en: "The hider picks three questions from three different categories. The seekers can't ask them for the rest of the round, not even at a higher cost.",
                        },
                        {
                            de: "die ganze Hand ablegen.",
                            en: "discard your whole hand.",
                        },
                        {
                            de: "Geht auch, während eine Frage offen ist, also bevor der Hider dafür Karten zieht. Die gerade gestellte Frage darf er aber nicht sperren.",
                            en: "Also possible while a question is open, before drawing cards for it. The question just asked can't be one of the three.",
                        },
                    ),
                    curse(
                        "water-weight",
                        "Water Weight",
                        "Wassergewicht",
                        {
                            de: "Die Seeker müssen 2 Liter Flüssigkeit pro Person besorgen und für den Rest der Runde mittragen; vorher keine neue Frage. Geht etwas davon verloren oder bleibt zurück, bekommt der Hider 30 Minuten Bonus (Large 60).",
                            en: "The seekers must get 2 litres of liquid per person and carry it for the rest of the round; no new question until they have. If any of it is lost or left behind, the hider gets a 30 minute bonus (Large 60).",
                        },
                        {
                            de: "Die Seeker sind höchstens 300 m von einem Gewässer entfernt.",
                            en: "the seekers are within 300 m of a body of water.",
                        },
                        {
                            de: "Was sie schon dabeihaben, zählt nicht. Verteilen dürfen sie es beliebig. Abstellen dürfen sie es, solange sie stehen oder in den Öffis sitzen; zurückgelassen ist es, sobald es mehr als 3 m von allen Seekern weg ist. Gewässer: auf der Karte eingezeichnet, kein Pool.",
                            en: "What they already carry doesn't count. They can share it out as they like. They may put it down while standing still or riding transit; it's left behind once it's more than 3 m from every seeker. Body of water: marked on the map, not a pool.",
                        },
                    ),
                    curse(
                        "zoologist",
                        "The Zoologist",
                        "Zoologe",
                        {
                            de: "Der Hider fotografiert ein wildes Tier: Fisch, Vogel, Säugetier, Reptil, Amphibie oder Krabbeltier. Die Seeker müssen ein wildes Tier derselben Gruppe fotografieren, bevor sie wieder fragen.",
                            en: "The hider photographs a wild animal: fish, bird, mammal, reptile, amphibian or bug. The seekers must photograph a wild animal of the same group before asking again.",
                        },
                        {
                            de: "ein Foto eines Tieres.",
                            en: "a photo of an animal.",
                        },
                        {
                            de: "Wild heißt: nicht gehalten, also auch nicht auf Bauernhöfen oder in Gehegen. Krabbeltiere sind Insekten, Spinnen, Tausendfüßer und Ähnliches. Bei Streit gilt Wikipedia.",
                            en: "Wild means not kept, so not on farms or in enclosures either. Bugs are insects, spiders, millipedes and the like. In a dispute, Wikipedia decides.",
                        },
                    ),
                    curse(
                        "egg-partner",
                        "The Egg Partner",
                        "Ei-Partner",
                        {
                            de: "Die Seeker müssen ein echtes Ei besorgen, bevor sie wieder fragen. Das Ei ist ab jetzt ein Teammitglied. Bleibt es zurück oder bekommt es einen Sprung, bekommt der Hider 30 Minuten Bonus (Medium 45, Large 60). Nicht im Endgame.",
                            en: "The seekers must get a real egg before asking again. The egg is now a team member. If it's left behind or gets a crack, the hider gets a 30 minute bonus (Medium 45, Large 60). Not during the endgame.",
                        },
                        {
                            de: "2 Karten ablegen.",
                            en: "discard 2 cards.",
                        },
                        {
                            de: "Bei anderen Flüchen für alle Seeker zählt das Ei mit (bei The Lemon Phylactery braucht es also auch eine Zitrone). Wer nichts kaufen will, nimmt den Fluch aus dem Deck.",
                            en: "For other curses on all seekers, the egg counts as one (with The Lemon Phylactery it needs a lemon too). If you don't want to buy things, take the curse out of the deck.",
                        },
                    ),
                    curse(
                        "jammed-door",
                        "The Jammed Door",
                        "Klemmende Tür",
                        {
                            de: "30 Minuten (Medium 1 Stunde, Large 3 Stunden) lang müssen die Seeker vor jeder Tür in ein Gebäude, ein Geschäft, einen Zug oder ein anderes Fahrzeug mit 2 Würfeln mindestens 7 würfeln. Sonst dürfen sie dort nicht hinein, auch nicht durch eine andere Tür. Dieselbe Tür dürfen sie nach 5 Minuten (Medium 10, Large 15) wieder versuchen.",
                            en: "For 30 minutes (Medium 1 hour, Large 3 hours), before every door into a building, shop, train or other vehicle, the seekers must roll at least 7 with 2 dice. Otherwise they can't enter, not even through another door. They may try the same door again after 5 minutes (Medium 10, Large 15).",
                        },
                        {
                            de: "2 Karten ablegen.",
                            en: "discard 2 cards.",
                        },
                        {
                            de: "Gewürfelt wird erst, wenn die Tür zu sehen ist, beim Zug also erst, wenn er da ist. Türen innerhalb desselben Gebäudes zählen nicht.",
                            en: "Roll only once the door is in sight, for a train only once it's there. Doors within the same building don't count.",
                        },
                    ),
                    curse(
                        "spotty-memory",
                        "Spotty Memory",
                        "Lückenhaftes Gedächtnis",
                        {
                            de: "Für den Rest der Runde ist immer eine zufällige Kategorie gesperrt. Die Seeker würfeln sie aus und nach jeder Frage neu; dieselbe Kategorie kann mehrmals hintereinander kommen.",
                            en: "For the rest of the round, one random category is always blocked. The seekers roll for it, and again after every question; the same category can come up several times in a row.",
                        },
                        {
                            de: "einen Zeitbonus ablegen.",
                            en: "discard a time bonus.",
                        },
                        {
                            de: "Vorher bekommt jede Kategorie eine Zahl. Small hat fünf Kategorien, bei einer 6 wird neu gewürfelt; Medium und Large haben mit den Tentakeln sechs.",
                            en: "Give each category a number first. Small has five categories, so a 6 is rolled again; Medium and Large have six, with tentacles.",
                        },
                    ),
                    curse(
                        "bird-guide",
                        "The Bird Guide",
                        "Vogelführer",
                        {
                            de: "Der Hider hat einen Versuch, einen Vogel so lange wie möglich zu filmen, höchstens 5 Minuten (Medium 10, Large 15) am Stück. Verlässt der Vogel das Bild, ist die Zeit vorbei. Die Seeker müssen dann einen Vogel mindestens genauso lange filmen; sie haben beliebig viele Versuche.",
                            en: "The hider has one go at filming a bird for as long as possible, at most 5 minutes (Medium 10, Large 15) straight. Once the bird leaves the frame, time's up. The seekers must then film a bird for at least as long; they have unlimited tries.",
                        },
                        {
                            de: "einen Vogel filmen.",
                            en: "film a bird.",
                        },
                    ),
                    curse(
                        "unguided-tourist",
                        "The Unguided Tourist",
                        "Tourist ohne Führer",
                        {
                            de: "Der Hider schickt ein Street-View-Bild von einer Straße höchstens 150 m von den Seekern: ohne Zoom, waagrecht, mit mindestens einem Bauwerk außer der Straße. Ohne Internet müssen die Seeker die Stelle finden und ein Foto davon schicken, bevor sie wieder Öffis nutzen oder fragen.",
                            en: "The hider sends a Street View image of a street within 150 m of the seekers: no zoom, level, with at least one structure other than the road. Without the internet, the seekers must find the spot and send a photo of it before using transit or asking again.",
                        },
                        {
                            de: "Die Seeker sind im Freien.",
                            en: "the seekers are outdoors.",
                        },
                        {
                            de: "Gehsteige und Randsteine zählen nicht als Bauwerk.",
                            en: "Pavements and kerbs don't count as structures.",
                        },
                    ),
                    curse(
                        "ransom-note",
                        "The Ransom Note",
                        "Erpresserbrief",
                        {
                            de: "Die nächste Frage der Seeker muss aus ausgeschnittenen Wörtern und Buchstaben aus Gedrucktem bestehen: mindestens 5 Wörter und verständlich.",
                            en: "The seekers' next question must be made of words and letters cut out of printed material: at least 5 words, and understandable.",
                        },
                        {
                            de: "„Ransom Note“ selbst als Erpresserbrief zusammensetzen, ohne diese Karte.",
                            en: "spell out “Ransom Note” as a ransom note yourself, without using this card.",
                        },
                        {
                            de: "Nichts selbst ausdrucken. Gängige Abkürzungen sind erlaubt; Zusatzinfos wie Standorte dürfen normal geschickt werden. Der Hider fängt erst an, wenn er gerade einen Fluch spielen dürfte, und spielt ihn dann sofort.",
                            en: "Nothing printed by the players themselves. Common abbreviations are fine; extra details like locations can be sent as usual. The hider only starts when they could play a curse right now, and plays it straight away.",
                        },
                    ),
                    curse(
                        "mediocre-travel-agent",
                        "The Mediocre Travel Agent",
                        "Mittelmäßiges Reisebüro",
                        {
                            de: "Der Hider wählt einen öffentlich zugänglichen Ort höchstens 400 m (Large 500 m) von den Seekern; sie dürfen gerade nicht in den Öffis sein. Die Seeker müssen hin, mindestens 5 Minuten (Large 10) bleiben, mindestens drei Urlaubsfotos schicken und ein Souvenir mitnehmen, bevor sie wieder fragen. Geht das Souvenir verloren, bevor sie den Hider finden, bekommt er 30 Minuten Bonus (Medium 45, Large 60).",
                            en: "The hider picks a publicly accessible place within 400 m (Large 500 m) of the seekers, who mustn't be on transit right now. The seekers must go there, stay at least 5 minutes (Large 10), send at least three holiday photos and pick up a souvenir before asking again. If the souvenir is lost before they find the hider, the hider gets a 30 minute bonus (Medium 45, Large 60).",
                        },
                        {
                            de: "Der Urlaubsort ist weiter vom Hider weg als die Seeker jetzt.",
                            en: "the holiday spot is further from the hider than the seekers are now.",
                        },
                    ),
                    curse(
                        "impressionable-consumer",
                        "The Impressionable Consumer",
                        "Beeinflussbare Kundschaft",
                        {
                            de: "Die Seeker müssen etwas kaufen oder irgendwo hineingehen (mit Eintritt, falls nötig), wofür sie draußen eine Werbung gesehen haben, bevor sie wieder fragen. Die Werbung muss mindestens 30 m vom Geschäft oder Produkt entfernt sein.",
                            en: "The seekers must buy something or go somewhere (paying admission if needed) that they saw an ad for out in the world, before asking again. The ad must be at least 30 m from the shop or product.",
                        },
                        {
                            de: "Die nächste Frage der Seeker ist gratis: Der Hider zieht dafür keine Karten.",
                            en: "the seekers' next question is free: the hider draws no cards for it.",
                        },
                        {
                            de: "Öffentliche Orte wie Parks zählen nicht. Wer kein Geld ausgeben will, nimmt den Fluch aus dem Deck.",
                            en: "Public places like parks don't count. If you don't want to spend money, take the curse out of the deck.",
                        },
                    ),
                    curse(
                        "u-turn",
                        "The U-Turn",
                        "Kehrtwende",
                        {
                            de: "Die Seeker müssen an der nächsten Station aussteigen, sofern dort innerhalb von 30 Minuten (Large 1 Stunde) etwas anderes fährt.",
                            en: "The seekers must get off at the next station, as long as something else leaves from there within 30 minutes (Large 1 hour).",
                        },
                        {
                            de: "Die Seeker fahren in die falsche Richtung: Ihre nächste Station ist weiter vom Hider weg als sie selbst.",
                            en: "the seekers are heading the wrong way: their next station is further from the hider than they are.",
                        },
                        {
                            de: "Nächste Station heißt: der nächste Halt dieser Fahrt. Im Zweifel fragt der Hider nach.",
                            en: "Next station means the next stop of this ride. If unsure, the hider asks.",
                        },
                    ),
                    curse(
                        "cairn",
                        "The Cairn",
                        "Steinmännchen",
                        {
                            de: "Der Hider hat einen Versuch, Steine zu einem freistehenden Turm zu stapeln. Jeder Stein berührt nur einen anderen, und vor jedem neuen Stein muss der Turm 5 Sekunden stehen. Fällt er, sagt der Hider, wie hoch er zuletzt 5 Sekunden stand. Die Seeker müssen einen gleich hohen Turm bauen, bevor sie wieder fragen; fällt ihrer, fangen sie neu an.",
                            en: "The hider has one go at stacking stones into a free-standing tower. Each stone touches only one other, and the tower must stand 5 seconds before the next stone. When it falls, the hider says how tall it last stood for 5 seconds. The seekers must build a tower as tall before asking again; if theirs falls, they start over.",
                        },
                        {
                            de: "einen Steinturm bauen.",
                            en: "build a stone tower.",
                        },
                        {
                            de: "Die Steine selbst finden, nicht kaufen, und danach wieder verstreuen.",
                            en: "Find the stones yourself, don't buy them, and scatter them again afterwards.",
                        },
                    ),
                    curse(
                        "distant-cuisine",
                        "The Distant Cuisine",
                        "Ferne Küche",
                        {
                            de: "Der Hider sucht in seiner Zone ein Restaurant, das ausdrücklich Küche aus einem bestimmten Land anbietet. Die Seeker müssen ein Restaurant besuchen, dessen Land mindestens genauso weit weg ist, bevor sie wieder fragen.",
                            en: "The hider finds a restaurant in their zone that explicitly serves food from one particular country. The seekers must visit a restaurant whose country is at least as far away before asking again.",
                        },
                        {
                            de: "Der Hider ist in diesem Restaurant.",
                            en: "the hider is at that restaurant.",
                        },
                        {
                            de: "Nur Restaurants mit genau einem Land (oder einer Region darin) im Namen oder auf der Speisekarte; „asiatisch“ zählt nicht. Gemessen wird vom Hider zum nächsten Punkt des Landes.",
                            en: "Only restaurants naming exactly one country (or a region within it) in their name or menu; “Asian” doesn't count. Measure from the hider to the nearest point of that country.",
                        },
                    ),
                    curse(
                        "lemon-phylactery",
                        "The Lemon Phylactery",
                        "Zitronen-Amulett",
                        {
                            de: "Jeder Seeker muss eine echte Zitrone finden und außen an Kleidung oder Haut befestigen, bevor sie wieder fragen. Berührt eine Zitrone ihren Seeker nicht mehr, bekommt der Hider 30 Minuten Bonus (Medium 45, Large 60). Nicht im Endgame.",
                            en: "Each seeker must find a real lemon and attach it to the outside of their clothes or skin before asking again. If a lemon stops touching its seeker, the hider gets a 30 minute bonus (Medium 45, Large 60). Not during the endgame.",
                        },
                        {
                            de: "ein Powerup ablegen.",
                            en: "discard a powerup.",
                        },
                    ),
                    curse(
                        "gamblers-feet",
                        "The Gambler's Feet",
                        "Spielerfüße",
                        {
                            de: "20 Minuten (Medium 40, Large 60) lang müssen die Seeker vor dem Gehen würfeln und dürfen nur so viele Schritte machen, wie der Würfel zeigt, dann wieder würfeln.",
                            en: "For 20 minutes (Medium 40, Large 60), the seekers must roll a die before walking and may only take as many steps as it shows, then roll again.",
                        },
                        {
                            de: "Der Hider würfelt; bei einer geraden Zahl wirkt der Fluch nicht.",
                            en: "the hider rolls a die; on an even number the curse has no effect.",
                        },
                        {
                            de: "Mehrere Seeker würfeln jeder selbst oder einer für alle. Wo Stehenbleiben gefährlich wäre, etwa auf der Straße, dürfen sie weitergehen.",
                            en: "Several seekers each roll for themselves, or one rolls for all. Where stopping would be unsafe, like in the road, they may keep going.",
                        },
                    ),
                    curse(
                        "hidden-hangman",
                        "The Hidden Hangman",
                        "Galgenmännchen",
                        {
                            de: "Bevor die Seeker wieder fragen oder in ein Verkehrsmittel steigen, müssen sie den Hider bei Galgenmännchen schlagen.",
                            en: "Before asking again or boarding any transport, the seekers must beat the hider at hangman.",
                        },
                        {
                            de: "2 Karten ablegen.",
                            en: "discard 2 cards.",
                        },
                        {
                            de: "Der Hider denkt sich ein echtes Wort mit 5 Buchstaben aus, in einer Sprache, die alle sprechen. Antwortet er einmal nicht innerhalb von 30 Sekunden, ist der Fluch erledigt.",
                            en: "The hider thinks of a real five-letter word, in a language everyone speaks. If they ever take more than 30 seconds to respond, the curse is cleared.",
                        },
                    ),
                    curse(
                        "endless-tumble",
                        "The Endless Tumble",
                        "Endloses Rollen",
                        {
                            de: "Die Seeker müssen einen Würfel mindestens 30 m weit rollen lassen, und er muss auf 5 oder 6 landen, bevor sie wieder fragen. Er muss die ganze Strecke von selbst rollen, nur durch den Wurf und das Gefälle. Treffen sie dabei jemanden, bekommt der Hider 10 Minuten Bonus (Medium 20, Large 30).",
                            en: "The seekers must roll a die at least 30 m and have it land on 5 or 6 before asking again. It must roll the whole way on its own, from the throw and the slope only. If they hit someone with it, the hider gets a 10 minute bonus (Medium 20, Large 30).",
                        },
                        {
                            de: "Der Hider würfelt; bei 5 oder 6 wirkt der Fluch nicht.",
                            en: "the hider rolls a die; on 5 or 6 the curse has no effect.",
                        },
                        {
                            de: "Die 30 m werden waagrecht gemessen, ein Hang hilft. Geht der Würfel verloren oder liegt er schief, zählt der Wurf nicht.",
                            en: "The 30 m are measured level; a slope helps. If the die is lost or doesn't land flat, the roll doesn't count.",
                        },
                    ),
                    curse(
                        "right-turn",
                        "The Right Turn",
                        "Rechts abbiegen",
                        {
                            de: "20 Minuten (Medium 40, Large 60) lang dürfen die Seeker an Kreuzungen nur rechts abbiegen. Geht es 300 m lang weder geradeaus noch rechts weiter, müssen sie umdrehen.",
                            en: "For 20 minutes (Medium 40, Large 60), the seekers may only turn right at intersections. If they can't go straight on or right for 300 m, they must turn around.",
                        },
                        {
                            de: "1 Karte ablegen.",
                            en: "discard 1 card.",
                        },
                        {
                            de: "Gilt nur an Kreuzungen von Straßen für Autos, samt Gehsteig. Jede Abzweigung nach rechts zählt als rechts. In Gebäuden wirkt der Fluch nicht.",
                            en: "Only applies at intersections of roads for cars, pavements included. Any road veering right counts as right. It has no effect indoors.",
                        },
                    ),
                    curse(
                        "urban-explorer",
                        "The Urban Explorer",
                        "Stadtforscher",
                        {
                            de: "Für den Rest der Runde dürfen die Seeker nicht fragen, solange sie in den Öffis oder in einer Station sind.",
                            en: "For the rest of the round, the seekers can't ask questions while on transit or in a station.",
                        },
                        {
                            de: "2 Karten ablegen.",
                            en: "discard 2 cards.",
                        },
                        {
                            de: "Neben einer Station dürfen sie fragen, nicht aber am Bahnsteig oder in Gebäuden der Station. Schon gestellte Fragen beantwortet der Hider trotzdem.",
                            en: "Next to a station they may ask, but not on the platform or in station buildings. Questions already asked still get answered.",
                        },
                    ),
                    curse(
                        "overflowing-chalice",
                        "The Overflowing Chalice",
                        "Überlaufender Kelch",
                        {
                            de: "Bei den nächsten drei Fragen zieht der Hider je eine Karte mehr, behält aber gleich viele: Matching und Measuring 4 ziehen, 1 behalten; Radar und Thermometer 3 ziehen, 1 behalten; Foto 2 ziehen, 1 behalten; Tentakel 5 ziehen, 2 behalten.",
                            en: "For the next three questions, the hider draws one extra card but keeps the same number: matching and measuring draw 4 keep 1; radar and thermometer draw 3 keep 1; photo draw 2 keep 1; tentacle draw 5 keep 2.",
                        },
                        {
                            de: "1 Karte ablegen.",
                            en: "discard 1 card.",
                        },
                    ),
                    curse(
                        "labyrinth",
                        "The Labyrinth",
                        "Labyrinth",
                        {
                            de: "Der Hider zeichnet höchstens 10 Minuten (Medium 20, Large 30) lang ein lösbares Labyrinth, ohne Vorlage aus dem Internet, und schickt ein Foto. Die Seeker müssen es lösen, bevor sie wieder fragen.",
                            en: "The hider spends up to 10 minutes (Medium 20, Large 30) drawing a solvable maze, without looking for designs online, and sends a photo. The seekers must solve it before asking again.",
                        },
                        {
                            de: "ein Labyrinth zeichnen.",
                            en: "draw a maze.",
                        },
                        {
                            de: "Lösbar heißt: Eine durchgehende Linie vom Start zum Ziel ist möglich. Die Zeit läuft ab dem ersten Strich.",
                            en: "Solvable means an unbroken line from start to finish is possible. Time runs from the first line drawn.",
                        },
                    ),
                ],
            },
        ],
    },
    {
        id: "endgame",
        title: { de: "Endgame", en: "Endgame" },
        blocks: [
            {
                de: "Das Endgame beginnt, sobald die Seeker in der Zone des Hiders sind und die Öffis verlassen haben; der Hider sieht das an ihrem Live-Standort. Ab dann bleibt er an einem einzigen Versteck, bis er gefunden wird.",
                en: "The endgame starts once the seekers are in the hider's zone and have left transit; the hider sees that from their live location. From then on, the hider stays at one hiding spot until found.",
            },
            {
                list: [
                    {
                        de: "Das Versteck liegt in der Zone und ist öffentlich zugänglich: keine Toilettenkabine, keine Wohnung. Öffentlicher Grund muss es nicht sein, nur zugänglich, und du solltest dort weder weggeschickt werden noch auffallen. Geschäfte meidest du besser.",
                        en: "The spot is in the zone and publicly accessible: no toilet cubicle, no one's home. It needn't be public land, just accessible, and you shouldn't get thrown out or look suspicious. Better avoid shops.",
                    },
                    {
                        de: "Es liegt höchstens 3 m von einem Weg oder einer Straße, die auf der Karte eingezeichnet sind. Die Seeker müssen bis auf 3 m an dich herankommen können.",
                        en: "It's within 3 m of a path or road shown on the map. The seekers must be able to get within 3 m of you.",
                    },
                    {
                        de: "Das Versteck steht fest, sobald das Endgame beginnt. Bist du dann nicht am geplanten Platz, gilt, wo du gerade bist. Ist das nicht öffentlich zugänglich, gehst du sofort zum nächsten Platz, der es ist.",
                        en: "The spot is fixed the moment the endgame starts. If you're not where you planned, wherever you are counts. If that's not publicly accessible, go straight to the nearest place that is.",
                    },
                    {
                        de: "Fragen gehen weiter. Kann der Hider eine Frage wegen des Verstecks nicht beantworten, etwa ein Foto vom Stationseingang, sagt er „kann ich nicht beantworten“ und zieht trotzdem Karten.",
                        en: "Questions go on. If the hider can't answer one because of their spot, like a photo from a station entrance, they say “I can't answer” and still draw cards.",
                    },
                    {
                        de: "Move und manche Flüche dürfen im Endgame nicht gespielt werden.",
                        en: "Move and some curses can't be played during the endgame.",
                    },
                ],
            },
            {
                de: "Ein gut gewähltes Versteck bringt oft noch eine Stunde oder mehr, auch wenn die Seeker die Station schon kennen.",
                en: "A well-chosen spot often buys another hour or more, even once the seekers know the station.",
            },
        ],
    },
    {
        id: "found",
        title: {
            de: "Gefunden und nächste Runde",
            en: "Found, and the next round",
        },
        blocks: [
            {
                de: "Der Hider ist gefunden, wenn ihn die Seeker sehen und höchstens 1,5 m entfernt sind. Wer nur in der Nähe ist, ihn aber nicht erkannt hat, hat ihn noch nicht gefunden.",
                en: "The hider is found once the seekers see them and are within 1.5 m. Being nearby without having spotted them doesn't count.",
            },
            {
                de: "Dann stoppt die Uhr. Die **Versteckzeit** ist die Zeit vom Ende der Versteckphase bis zum Finden, dazu kommen die Zeitbonus-Karten auf der Hand.",
                en: "Then the clock stops. The **hiding time** runs from the end of the hiding period until found, plus the time bonus cards in hand.",
            },
            {
                de: "Der nächste Hider hat 10 Minuten zur Vorbereitung: Er übernimmt das Hider-Deck und schaltet seinen Live-Standort aus. Die neue Runde startet dort, wo der vorige Hider gefunden wurde.",
                en: "The next hider gets 10 minutes to get ready: they take over the hider deck and turn off their live location. The new round starts where the previous hider was found.",
            },
            {
                de: "**In der App:** {found} auf der Spielzeit-Uhr stoppt die Versteckzeit; die Zeitbonus-Karten auf der Hand rechnet ihr von Hand dazu. Danach Zahnrad → {newGame}, jeder mit seiner neuen Rolle.",
                en: "**In the app:** {found} on the game timer stops the hiding time; add the time bonus cards in hand yourselves. Then gear → {newGame}, everyone with their new role.",
            },
        ],
    },
    {
        id: "end",
        title: { de: "Spielende", en: "End of the game" },
        blocks: [
            {
                de: "Das Spiel endet, wenn sich jeder so oft versteckt hat wie vereinbart, normalerweise einmal. Es gewinnt die längste einzelne Versteckzeit. Spielt ihr mehr Runden, zählt für jeden nur seine beste.",
                en: "The game ends once everyone has hidden as often as agreed, usually once. The longest single hiding time wins. If you play extra rounds, only each player's best counts.",
            },
            {
                de: "Müsst ihr zu einer bestimmten Zeit aufhören, stellt einen Wecker: Das Spiel endet, wenn alle Runden gespielt sind oder die Zeit um ist, je nachdem, was zuerst kommt.",
                en: "If you have to stop at a certain time, set a timer: the game ends when all rounds are played or time is up, whichever comes first.",
            },
        ],
    },
    {
        id: "tips",
        title: { de: "Tipps", en: "Tips" },
        blocks: [
            {
                list: [
                    {
                        de: "Genug Essen und Trinken mitnehmen; als Hider bist du vielleicht stundenlang ohne.",
                        en: "Bring enough food and water; as the hider you may go without for hours.",
                    },
                    {
                        de: "Eine Powerbank mitnehmen: GPS, Karte und Chat brauchen viel Akku.",
                        en: "Bring a power bank: GPS, map and chat use a lot of battery.",
                    },
                    {
                        de: "Als Hider eine Toilette in der Zone suchen; kleine Stationen haben oft keine.",
                        en: "As the hider, find a toilet in your zone; small stations often have none.",
                    },
                    {
                        de: "Aufs Wetter achten.",
                        en: "Keep an eye on the weather.",
                    },
                    {
                        de: "Pausieren ist erlaubt, wenn es nötig ist, nicht als Taktik. Dann stehen alle Uhren still, und alle machen dort weiter, wo sie waren.",
                        en: "Pausing is allowed when needed, not as a tactic. All clocks stop, and everyone carries on from where they were.",
                    },
                    {
                        de: "Sicherheit geht vor. Teilt euren Standort zusätzlich mit jemandem, der nicht mitspielt.",
                        en: "Safety first. Also share your location with someone who isn't playing.",
                    },
                ],
            },
        ],
    },
    {
        id: "glossary",
        title: { de: "Begriffe", en: "Glossary" },
        blocks: [
            {
                list: [
                    {
                        de: "**Hider:** wer sich in dieser Runde versteckt.",
                        en: "**Hider:** whoever hides this round.",
                    },
                    {
                        de: "**Seeker:** alle anderen; sie suchen gemeinsam.",
                        en: "**Seekers:** everyone else; they search together.",
                    },
                    {
                        de: "**Hiding Zone:** der Kreis um die Station des Hiders, in dem er sich frei bewegen darf.",
                        en: "**Hiding zone:** the circle around the hider's station in which they can move freely.",
                    },
                    {
                        de: "**Versteckphase:** der Anfang jeder Runde, um die Zone zu erreichen (Small 30 Minuten).",
                        en: "**Hiding period:** the start of each round, to reach the zone (Small 30 minutes).",
                    },
                    {
                        de: "**Versteckzeit:** vom Ende der Versteckphase bis zum Finden, plus Zeitbonus. Sie entscheidet, wer gewinnt.",
                        en: "**Hiding time:** from the end of the hiding period until found, plus time bonuses. It decides who wins.",
                    },
                    {
                        de: "**Endgame:** ab dem Moment, in dem die Seeker in der Zone sind und die Öffis verlassen haben; der Hider bleibt an seinem Versteck.",
                        en: "**Endgame:** from the moment the seekers are in the zone and off transit; the hider stays at their spot.",
                    },
                    {
                        de: "**Zeitbonus, Powerup, Fluch:** die drei Arten von Karten im Hider-Deck.",
                        en: "**Time bonus, powerup, curse:** the three kinds of cards in the hider deck.",
                    },
                ],
            },
        ],
    },
];

/** Every section and entry by its id, to jump to. */
export const ruleIds = () =>
    RULE_SECTIONS.flatMap((section) => [
        section.id,
        ...(section.groups ?? []).flatMap((group) =>
            group.entries.map((entry) => entry.id),
        ),
    ]);

/** The entry the "?" on a question opens. */
export const ruleIdFor = (question: Question): string => {
    switch (question.id) {
        case "matching": {
            const card = matchingCardFor(question.data);
            return card ? `matching-${card.id}` : "matching";
        }
        case "measuring": {
            const card = measuringCardFor(question.data);
            return card ? `measuring-${card.id}` : "measuring";
        }
        case "radius":
            return "radar";
        case "thermometer":
            return "thermometer";
        case "tentacles":
            return "tentacles";
        default:
            return "asking";
    }
};

/** The entry of a photo card. */
export const photoRuleId = (cardId: string) =>
    PHOTO_DECK.some((card) => card.id === cardId) ? `photo-${cardId}` : "photo";

/** The entry for a question in the hider's log. */
export const hiderEntryRuleId = (entry: HiderInboxEntry) =>
    entry.question
        ? ruleIdFor(entry.question)
        : entry.photo
          ? photoRuleId(entry.photo)
          : (entry.kind ?? "asking");

/**
 * The quick guide: one card per step, with a picture of the app in the
 * app's language (public/guide/<id>-<language>.webp).
 */
export const GUIDE_SLIDES: { id: string; title: Text; text: Text }[] = [
    {
        id: "new-game",
        title: { de: "Neues Spiel", en: "New game" },
        text: {
            de: "Tippe oben rechts auf das Zahnrad und dann auf {newGame}. Wähle {seeking} oder {hiding}. Die App lädt die Karte von Wien mit allen Zonen; beim ersten Mal dauert das ein paar Minuten.",
            en: "Tap the gear at the top right, then {newGame}. Choose {seeking} or {hiding}. The app loads the map of Vienna with all zones; the first time, that takes a few minutes.",
        },
    },
    {
        id: "ask",
        title: { de: "Frage stellen", en: "Ask a question" },
        text: {
            de: "Als Seeker tippst du unten auf {ask} und wählst eine Karte. Die Frage nimmt deinen Standort. Mit {sendToHider} schickst du sie als Link in den Chat, ab dann läuft die Uhr des Hiders.",
            en: "As a seeker, tap {ask} at the bottom and pick a card. The question takes your location. {sendToHider} sends it to the chat as a link, and the hider's clock starts.",
        },
    },
    {
        id: "answer",
        title: { de: "Antwort eintragen", en: "Enter the answer" },
        text: {
            de: "Kommt die Antwort im Chat, tippst du sie auf der Frage ein. Erst dann ändert sich die Karte. Offene und beantwortete Fragen findest du unten unter {questions}.",
            en: "When the answer arrives in the chat, enter it on the question. Only then does the map change. Open and answered questions are under {questions} at the bottom.",
        },
    },
    {
        id: "map",
        title: { de: "Karte lesen", en: "Reading the map" },
        text: {
            de: "Hell ist, wo der Hider noch sein kann, grau ist ausgeschlossen. Oben links steht, wie viele Zonen übrig sind. Tippe eine Zone an, um ihre Station zu sehen; {zones} unten öffnet die Liste aller Zonen.",
            en: "Bright is where the hider can still be, grey is ruled out. The top left shows how many zones are left. Tap a zone to see its station; {zones} at the bottom opens the list of all zones.",
        },
    },
    {
        id: "hider",
        title: { de: "Als Hider", en: "As the hider" },
        text: {
            de: "Tippe zu Beginn auf {startTimer} und wähle deine Zone auf dem Hider-Bildschirm, oder tippe sie auf der Karte an und wähle {chooseZone}. Fragen kommen als Link: Die App rechnet die Antwort an deinem Standort aus, und du schickst sie mit {sendAnswer} in den Chat.",
            en: "At the start, tap {startTimer} and choose your zone on the hider screen, or tap it on the map and choose {chooseZone}. Questions arrive as links: the app works out the answer at your location, and {sendAnswer} sends it to the chat.",
        },
    },
];

/** The help's own buttons, in the help's language like everything in it. */
export const HELP_TEXTS = {
    title: { de: "Hilfe", en: "Help" },
    guide: { de: "Kurzanleitung", en: "Quick guide" },
    rules: { de: "Regeln", en: "Rules" },
    contents: { de: "Inhalt", en: "Contents" },
    next: { de: "Weiter", en: "Next" },
    back: { de: "Zurück", en: "Back" },
    skip: { de: "Überspringen", en: "Skip" },
    done: { de: "Los geht's", en: "Let's go" },
    readRules: { de: "Regeln lesen", en: "Read the rules" },
    close: { de: "Schließen", en: "Close" },
    step: { de: "{n} von {count}", en: "{n} of {count}" },
    toTop: { de: "Zum Inhalt", en: "To contents" },
    rulesHint: {
        de: "Die Regeln und was bei jeder Frage zählt, stehen unter „Regeln“. Das „?“ an jeder Frage führt direkt hin.",
        en: "The rules, and what counts for each question, are under “Rules”. The “?” on every question takes you straight there.",
    },
} satisfies Record<string, Text>;
