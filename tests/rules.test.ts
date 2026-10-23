import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { Text } from "@/lib/i18n";
import { messages } from "@/lib/messages";
import {
    cardQuestionData,
    MATCHING_DECK,
    MEASURING_DECK,
    PHOTO_DECK,
} from "@/maps/deck";
import {
    GUIDE_SLIDES,
    HELP_TEXTS,
    hiderEntryRuleId,
    photoRuleId,
    RULE_SECTIONS,
    type RuleBlock,
    ruleIdFor,
    ruleIds,
} from "@/maps/rules";
import { questionSchema } from "@/maps/schema";

const texts = (block: RuleBlock): Text[] =>
    "list" in block ? block.list : [block];

const allTexts = (): [string, Text][] => [
    ...RULE_SECTIONS.flatMap((section) => [
        [section.id, section.title] as [string, Text],
        ...section.blocks
            .flatMap(texts)
            .map((text) => [section.id, text] as [string, Text]),
        ...(section.groups ?? []).flatMap((group) => [
            ...(group.title
                ? [[section.id, group.title] as [string, Text]]
                : []),
            ...group.entries.flatMap((entry) => [
                [entry.id, entry.title] as [string, Text],
                ...entry.blocks
                    .flatMap(texts)
                    .map((text) => [entry.id, text] as [string, Text]),
            ]),
        ]),
    ]),
    ...GUIDE_SLIDES.flatMap((slide) => [
        [slide.id, slide.title] as [string, Text],
        [slide.id, slide.text] as [string, Text],
    ]),
    ...Object.entries(HELP_TEXTS),
];

const placeholders = (text: string) =>
    [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

/** The app's buttons the help may name (HelpDialog.tsx). */
const BUTTONS = [
    "ask",
    "questions",
    "zones",
    "newGame",
    "seeking",
    "hiding",
    "sendToHider",
    "sendAnswer",
    "chooseZone",
    "changeZone",
    "startTimer",
    "startSeeking",
    "pause",
    "resume",
    "found",
    "tellHider",
    "pasteLink",
    "hiderMoved",
    "moving",
    "pickOnMap",
];

const PUBLIC = new URL("../public/", import.meta.url).pathname;

describe("the rules and the quick guide", () => {
    it("are written in German and English", () => {
        for (const [where, text] of allTexts()) {
            expect(text.de.trim(), `${where} (German)`).not.toBe("");
            expect(text.en.trim(), `${where} (English)`).not.toBe("");
            expect(placeholders(text.de), `${where}: placeholders`).toEqual(
                placeholders(text.en),
            );
            // Bold words come in pairs of **
            expect(text.de.split("**").length % 2, where).toBe(1);
            expect(text.en.split("**").length % 2, where).toBe(1);
        }
    });

    it("only name buttons the app has", () => {
        const named = allTexts()
            .filter(([where]) => !(where in HELP_TEXTS))
            .flatMap(([, text]) => placeholders(text.en));
        expect(named.filter((name) => !BUTTONS.includes(name))).toEqual([]);
        expect(messages["send.button"]).toBeTruthy();
    });

    it("give every section and entry its own id", () => {
        const ids = ruleIds();
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("explain every card of the deck", () => {
        const ids = new Set(ruleIds());
        const entries = RULE_SECTIONS.flatMap((section) =>
            (section.groups ?? []).flatMap((group) => group.entries),
        );
        for (const [deck, cards] of [
            ["matching", MATCHING_DECK],
            ["measuring", MEASURING_DECK],
        ] as const) {
            for (const card of cards) {
                const entry = entries.find(
                    (entry) => entry.id === `${deck}-${card.id}`,
                );
                expect(entry, `${deck}: ${card.id}`).toBeTruthy();
                // The question in quotes, and what counts
                expect(entry!.blocks.length, card.id).toBeGreaterThanOrEqual(2);
                expect(
                    (entry!.blocks[0] as Text).de.startsWith("„"),
                    card.id,
                ).toBe(true);
            }
        }
        for (const card of PHOTO_DECK) {
            expect(ids.has(photoRuleId(card.id)), card.id).toBe(true);
        }
    });

    it("open the rule of a question with its ?", () => {
        const ids = new Set(ruleIds());
        const question = (id: string, data: object) =>
            questionSchema.parse({
                id,
                data: { lat: 48.2, lng: 16.37, ...data },
            });
        for (const card of MATCHING_DECK.filter((card) => card.type)) {
            const ruleId = ruleIdFor(
                question("matching", cardQuestionData(card)),
            );
            expect(ruleId).toBe(`matching-${card.id}`);
        }
        for (const card of MEASURING_DECK.filter((card) => card.type)) {
            const ruleId = ruleIdFor(
                question("measuring", cardQuestionData(card)),
            );
            expect(ruleId).toBe(`measuring-${card.id}`);
        }
        for (const ruleId of [
            ruleIdFor(question("radius", { radius: 2, unit: "kilometers" })),
            ruleIdFor(
                question("thermometer", {
                    latA: 48.2,
                    lngA: 16.37,
                    latB: 48.21,
                    lngB: 16.37,
                }),
            ),
            hiderEntryRuleId({
                key: 1,
                kind: "radar",
                askedAt: 0,
                receivedAt: 0,
            }),
            hiderEntryRuleId({
                key: 2,
                photo: "tree",
                askedAt: 0,
                receivedAt: 0,
            }),
        ]) {
            expect(ids.has(ruleId), ruleId).toBe(true);
        }
        expect(
            ruleIdFor(
                question("tentacles", {
                    radius: 1.6,
                    unit: "kilometers",
                    locationType: "museum",
                }),
            ),
        ).toBe("tentacles");
    });

    it("show a picture of the app for every card of the quick guide", () => {
        for (const slide of GUIDE_SLIDES) {
            for (const lang of ["de", "en"]) {
                const file = `${PUBLIC}guide/${slide.id}-${lang}.webp`;
                expect(existsSync(file), file).toBe(true);
            }
        }
    });
});
