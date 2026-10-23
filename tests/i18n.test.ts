import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { hasMessage, labelOf, language, t, type Text, tr } from "@/lib/i18n";
import { messages } from "@/lib/messages";
import { answerOptions, formatKilometers, questionTitle } from "@/maps/answers";
import { prettifyLocation } from "@/maps/api";
import {
    ADMIN_LEVEL_LABELS,
    MATCHING_DECK,
    MEASURING_DECK,
    PHOTO_DECK,
} from "@/maps/deck";
import {
    determineUnionizedStrings,
    matchingQuestionSchema,
    measuringQuestionSchema,
    NO_GROUP,
    questionSchema,
    tentacleQuestionSchema,
} from "@/maps/schema";

const placeholders = (text: string) =>
    [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

const expectBoth = (text: Text, name: string) => {
    expect(text.en.trim(), `${name} (English)`).not.toBe("");
    expect(text.de.trim(), `${name} (German)`).not.toBe("");
    expect(placeholders(text.de), `${name}: same {placeholders}`).toEqual(
        placeholders(text.en),
    );
};

const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return sourceFiles(path);
        return /\.(ts|tsx)$/.test(name) ? [path] : [];
    });

const SRC = new URL("../src/", import.meta.url).pathname;

/*
 * The files that are completely translated: every file that shows players
 * something. Left out: the deck, the rules and messages.ts (both languages
 * side by side; tests/rules.test.ts checks the rules) and schema.ts, whose
 * checks of saved data only developers see.
 */
const TRANSLATED_FILES = [
    "components/AddQuestionDialog.tsx",
    "components/AnswerClock.tsx",
    "components/AskQuestion.tsx",
    "components/BottomBar.tsx",
    "components/CustomInitDialog.tsx",
    "components/CustomPresets.tsx",
    "components/DraggableMarkers.tsx",
    "components/HelpDialog.tsx",
    "components/HiderScreen.tsx",
    "components/HidingZones.tsx",
    "components/LatLngPicker.tsx",
    "components/LoadingIndicator.tsx",
    "components/LocatingToast.tsx",
    "components/Map.tsx",
    "components/MapControls.tsx",
    "components/MapLayers.tsx",
    "components/NearestMarks.tsx",
    "components/NewGameDialog.tsx",
    "components/OptionDrawers.tsx",
    "components/OverpassAccessSettings.tsx",
    "components/PlacePicker.tsx",
    "components/PolygonDraw.tsx",
    "components/PresetsDialog.tsx",
    "components/QuestionSidebar.tsx",
    "components/UndoToast.tsx",
    "components/UnitSelect.tsx",
    "components/ZoneSheet.tsx",
    "components/cards/answer.tsx",
    "components/cards/base.tsx",
    "components/cards/location.tsx",
    "components/cards/matching.tsx",
    "components/cards/measuring.tsx",
    "components/cards/nearest.tsx",
    "components/cards/photo.tsx",
    "components/cards/radius.tsx",
    "components/cards/tentacles.tsx",
    "components/cards/thermometer.tsx",
    "components/ui/dialog.tsx",
    "components/ui/multi-select.tsx",
    "components/ui/sheet.tsx",
    "components/ui/sidebar-l.tsx",
    "lib/gps.ts",
    "lib/loading.tsx",
    "lib/overpassAccess.ts",
    "maps/answers.ts",
    "maps/deadline.ts",
    "maps/api/elevation.ts",
    "maps/api/geo.ts",
    "maps/api/overpass.ts",
    "maps/hider.ts",
    "maps/hiderLog.ts",
    "maps/hidingZoneCheck.ts",
    "maps/mapLayers.ts",
    "maps/nearest.ts",
    "maps/questions/matching.ts",
    "maps/questions/measuring.ts",
    "maps/stations.ts",
];

/** Words that are the same in both languages: the kinds of questions. */
const SAME_IN_BOTH = new Set([
    "Matching",
    "Measuring",
    "Radar",
    "Thermometer",
    "Deutsch",
    "English",
    "Photon",
]);

/** English text written straight into a file instead of through t(). */
const untranslated = (file: string) => {
    const source = file
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|\s)\/\/.*$/gm, "")
        // Messages for developers, not players
        .replace(/console\.\w+\([^;]*\);/g, "")
        .replace(/new \w*Error\([^;]*\);/g, "");
    return [
        // Text between JSX tags, like <span>Rule out</span>
        ...[
            ...source.matchAll(
                /(?<![=-])>\s*([A-Z][a-z]+(?:[\s,.'’!?&;:()-]+[A-Za-z]+)*[.!?]?)\s*</g,
            ),
        ].map((match) => match[1]),
        // Texts in attributes, like title="Back"
        ...[
            ...source.matchAll(
                /\b(?:title|label|trigger|placeholder|sub|aria-label)="([^"]*[A-Za-z][^"]*)"/g,
            ),
        ].map((match) => match[1]),
        // Messages, like toast.error("Couldn't ...")
        ...[
            ...source.matchAll(
                /\b(?:toast(?:\.\w+)?|confirm|alert)\(\s*(["'`][^"'`]*)/g,
            ),
        ].map((match) => match[1]),
        // Sentences in quotes, like "No GPS signal"
        ...[...source.matchAll(/(["`])([A-Z][a-z']+ [^"`$]*?)\1/g)].map(
            (match) => match[2],
        ),
    ].filter((text) => !SAME_IN_BOTH.has(text) && !/^https?:/.test(text));
};

describe("the app in German and English", () => {
    it("speaks English unless the phone chose German", () => {
        expect(language.get()).toBe("en");
    });

    it("has every text in both languages", () => {
        for (const [key, text] of Object.entries(messages)) {
            expectBoth(text, key);
        }
    });

    it("has every card of the deck in both languages", () => {
        for (const card of [...MATCHING_DECK, ...MEASURING_DECK]) {
            expectBoth(card.label, `${card.id}: label`);
            expectBoth(card.group, `${card.id}: group`);
            if (card.hint) expectBoth(card.hint, `${card.id}: hint`);
            if (card.noAnswer) expectBoth(card.noAnswer, `${card.id}: why not`);
        }
        for (const card of PHOTO_DECK) {
            expectBoth(card.label, `${card.id}: label`);
            expectBoth(card.hint, `${card.id}: hint`);
        }
        for (const [level, label] of Object.entries(ADMIN_LEVEL_LABELS)) {
            expectBoth(label, `admin level ${level}`);
        }
    });

    it("knows every text the code asks for", () => {
        const missing = sourceFiles(SRC).flatMap((file) =>
            [...readFileSync(file, "utf8").matchAll(/\btx?\(\s*"([^"]+)"/g)]
                .map((match) => match[1])
                .filter((key) => !hasMessage(key))
                .map((key) => `${file.replace(SRC, "")}: ${key}`),
        );
        expect(missing).toEqual([]);
    });

    it("names every kind of question for experts", () => {
        const labels = (
            schema: { options: readonly any[] },
            field: "type" | "locationType",
        ) =>
            schema.options.flatMap((option) => [
                option.description as string,
                ...determineUnionizedStrings(option.shape[field]).map(
                    (literal) => literal.description as string,
                ),
            ]);
        const missing = [
            ...labels(matchingQuestionSchema, "type"),
            ...labels(measuringQuestionSchema, "type"),
            ...labels(tentacleQuestionSchema, "locationType"),
        ].filter((label) => label !== NO_GROUP && !hasMessage(label));
        expect(missing).toEqual([]);

        language.set("de");
        expect(labelOf("type.park-full")).toBe("Park (Small und Medium)");
        expect(labelOf("anything else")).toBe("anything else");
    });

    it("names every kind of place", () => {
        for (const place of [
            "aquarium",
            "zoo",
            "theme_park",
            "peak",
            "museum",
            "hospital",
            "cinema",
            "library",
            "golf_course",
            "consulate",
            "park",
        ] as const) {
            expect(hasMessage(`places.${place}`), place).toBe(true);
        }
        language.set("de");
        expect(t("loading.places", { what: prettifyLocation("museum") })).toBe(
            "Suche Museen …",
        );
        language.set("en");
        expect(t("loading.places", { what: prettifyLocation("museum") })).toBe(
            "Finding museums...",
        );
        language.set("de");
    });

    it("names what's nearest for every card", () => {
        const whats = [
            ...MATCHING_DECK.filter((card) => card.type?.endsWith("-full")),
            ...MEASURING_DECK.filter((card) => card.type?.endsWith("-full")),
        ]
            .map((card) => card.id)
            .concat(["station", "street", "high-speed", "water"]);
        for (const what of whats) {
            expect(hasMessage(`nearest.title.${what}`), what).toBe(true);
            expect(hasMessage(`nearest.noun.${what}`), what).toBe(true);
        }
    });

    it.each(["de", "en"] as const)("labels every answer (%s)", (lang) => {
        language.set(lang);
        const questions = [
            { id: "radius", data: { radius: 2, unit: "kilometers" } },
            {
                id: "thermometer",
                data: { latA: 48.2, lngA: 16.37, latB: 48.21, lngB: 16.37 },
            },
            { id: "measuring", data: { type: "water" } },
            { id: "matching", data: { type: "same-length-station" } },
            { id: "matching", data: { type: "park-full" } },
        ].map((question) =>
            questionSchema.parse({
                ...question,
                data: { lat: 48.2, lng: 16.37, ...question.data },
            }),
        );
        for (const question of questions) {
            expect(questionTitle(question)).toBeTruthy();
            for (const option of answerOptions(question)) {
                expect(option.label, option.value).toBeTruthy();
            }
        }
        language.set("de");
    });

    it("writes German the German way", () => {
        language.set("de");
        expect(formatKilometers(1.23)).toBe("1,2 km");
        expect(formatKilometers(0.35)).toBe("350 m");
        expect(t("zones.left", { left: 37, total: 99 })).toBe(
            "37 von 99 Zonen übrig",
        );
        expect(tr(MATCHING_DECK[1].label)).toBe("Öffi-Linie");
        language.set("en");
        expect(formatKilometers(1.23)).toBe("1.2 km");
        language.set("de");
    });

    it("has no English left in the translated files", () => {
        const found = TRANSLATED_FILES.flatMap((file) =>
            untranslated(readFileSync(join(SRC, file), "utf8")).map(
                (text) => `${file}: ${text}`,
            ),
        );
        expect(found).toEqual([]);
    });
});
