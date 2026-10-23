import { beforeEach, describe, expect, it } from "vitest";

import { hiderInbox, type HiderInboxEntry, questions } from "@/lib/context";
import { language } from "@/lib/i18n";
import {
    ANSWER_MINUTES,
    clockStart,
    countdown,
    countdownText,
    formatMinutes,
    PHOTO_ANSWER_MINUTES,
} from "@/maps/deadline";
import { PHOTO_DECK } from "@/maps/deck";
import {
    addEntryByHand,
    answeredLate,
    answerMessage,
    answerMinutes,
    cardDraw,
    entryTitle,
    isOpen,
    lateIntervals,
    markAnswered,
    receiveEntry,
    removeEntry,
    reopenEntry,
} from "@/maps/hiderLog";
import { questionSchema } from "@/maps/schema";

const T0 = new Date(2026, 9, 22, 20, 30, 0).getTime();

const radar = (key: number) =>
    questionSchema.parse({
        id: "radius",
        key,
        data: {
            lat: 48.2,
            lng: 16.37,
            radius: 2,
            unit: "kilometers",
            status: "pending",
            askedAt: T0,
        },
    });

const fromLink = (key: number): HiderInboxEntry => ({
    key,
    question: radar(key),
    askedAt: T0,
    receivedAt: T0 + 5_000,
});

describe("the time the hider has to answer", () => {
    beforeEach(() => language.set("en"));

    it("is five minutes, photos ten (Small game)", () => {
        expect(ANSWER_MINUTES).toBe(5);
        expect(PHOTO_ANSWER_MINUTES).toBe(10);
        expect(answerMinutes({})).toBe(5);
        expect(answerMinutes({ photo: "tree" })).toBe(10);
    });

    it("starts when the seekers first sent the question", () => {
        expect(clockStart({ sentAt: T0 + 20_000 })).toBe(T0 + 20_000);
        // Not sent yet: the clock doesn't run
        expect(clockStart({})).toBeUndefined();
    });

    it("counts down and turns urgent in the last minute", () => {
        const start = countdown(T0, 5, T0);
        expect(start.due).toBe(T0 + 5 * 60_000);
        expect(start.urgent).toBe(false);
        expect(countdownText(start)).toBe("Answer due 20:35 · 5:00 left");

        const later = countdown(T0, 5, T0 + 3 * 60_000 + 12_500);
        expect(countdownText(later)).toBe("Answer due 20:35 · 1:48 left");
        expect(later.urgent).toBe(false);

        const almost = countdown(T0, 5, T0 + 4 * 60_000 + 30_000);
        expect(almost.urgent).toBe(true);

        // Photos: the last two of ten minutes
        expect(countdown(T0, 10, T0 + 7 * 60_000).urgent).toBe(false);
        expect(countdown(T0, 10, T0 + 8 * 60_000).urgent).toBe(true);
    });

    it("says how late the answer is", () => {
        const late = countdown(T0, 5, T0 + 5 * 60_000 + 45_000);
        expect(late.urgent).toBe(true);
        expect(countdownText(late)).toBe("Answer was due 20:35 · 0:45 late");

        language.set("de");
        expect(countdownText(late)).toBe(
            "Antwort war bis 20:35 fällig · 0:45 zu spät",
        );
        expect(countdownText(countdown(T0, 5, T0 + 3 * 60 * 60_000))).toBe(
            "Antwort war bis 20:35 fällig",
        );
    });

    it("shows minutes and seconds", () => {
        expect(formatMinutes(0)).toBe("0:00");
        expect(formatMinutes(65_000)).toBe("1:05");
        expect(formatMinutes(-3_000)).toBe("0:00");
    });
});

describe("the hider's question log", () => {
    beforeEach(() => {
        language.set("en");
        hiderInbox.set([]);
        questions.set([]);
    });

    it("keeps a question that comes twice once, with its answer", () => {
        receiveEntry(fromLink(0.1));
        receiveEntry(fromLink(0.1));
        expect(hiderInbox.get()).toHaveLength(1);
        expect(isOpen(hiderInbox.get()[0])).toBe(true);

        markAnswered(0.1, { value: "inside" });
        receiveEntry({ ...fromLink(0.1), receivedAt: T0 + 60_000 });
        expect(hiderInbox.get()).toHaveLength(1);
        expect(isOpen(hiderInbox.get()[0])).toBe(false);
        expect(hiderInbox.get()[0].sent).toEqual({ value: "inside" });
    });

    it("puts the answer on the hider's map, like on the seekers' map", () => {
        receiveEntry(fromLink(0.2));
        expect(questions.get()).toHaveLength(0);

        markAnswered(0.2, { value: "outside" });
        const [onMap] = questions.get();
        expect(onMap.key).toBe(0.2);
        expect(onMap.data.status).toBe("answered");
        expect(onMap.data.drag).toBe(false);
        expect(onMap.id === "radius" && onMap.data.within).toBe(false);

        // Opened again: the map forgets the answer
        reopenEntry(0.2);
        expect(questions.get()).toHaveLength(0);
        expect(isOpen(hiderInbox.get()[0])).toBe(true);
    });

    it("keeps questions without an answer off the map", () => {
        receiveEntry(fromLink(0.3));
        markAnswered(0.3, { value: "no-answer" });
        expect(questions.get()[0].data.status).toBe("no-answer");
    });

    it("writes the answer for the seekers' chat", () => {
        const entry = fromLink(0.4);
        expect(answerMessage(entry, { value: "inside" })).toBe(
            "Radar 2 km – answer: Inside",
        );
        language.set("de");
        expect(answerMessage(entry, { value: "inside" })).toBe(
            "Radar 2 km – Antwort: Innerhalb",
        );
    });

    it("takes photos and questions from the chat by hand", () => {
        const photo = addEntryByHand({ photo: "tree" });
        const chat = addEntryByHand({ kind: "radar" });
        expect(photo.byHand).toBe(true);
        expect(entryTitle(photo)).toBe("Photo: Tree");
        expect(answerMinutes(photo)).toBe(10);
        expect(entryTitle(chat)).toBe("Radar");
        expect(answerMinutes(chat)).toBe(5);
        expect(answerMessage(photo, { value: "no-answer" })).toBe(
            "Photo: Tree – answer: No answer",
        );

        // Answering them doesn't touch the map
        markAnswered(photo.key, { value: "photo" });
        markAnswered(chat.key, { value: "answered" });
        expect(questions.get()).toHaveLength(0);
        expect(hiderInbox.get().filter(isOpen)).toHaveLength(0);

        removeEntry(photo.key);
        expect(hiderInbox.get()).toHaveLength(1);
    });

    it("has the six photo cards of a Small game", () => {
        expect(PHOTO_DECK.map((card) => card.id)).toEqual([
            "building-from-station",
            "widest-street",
            "tree",
            "tallest-in-sight",
            "selfie",
            "sky",
        ]);
    });

    it("tells the hider which cards to draw", () => {
        const first: HiderInboxEntry = {
            key: 1,
            question: radar(1),
            askedAt: T0,
            receivedAt: T0,
            answeredAt: T0 + 2 * 60_000,
        };
        const again: HiderInboxEntry = {
            ...first,
            key: 2,
            question: radar(2),
            askedAt: T0 + 30 * 60_000,
            answeredAt: T0 + 31 * 60_000,
        };
        const photo: HiderInboxEntry = {
            key: 3,
            photo: PHOTO_DECK[0].id,
            askedAt: T0,
            receivedAt: T0,
            answeredAt: T0 + 9 * 60_000,
        };
        const inbox = [first, again, photo];

        // Radar: draw 2, keep 1; the second time twice
        expect(cardDraw(first, inbox)).toEqual({ draw: 2, keep: 1, times: 1 });
        expect(cardDraw(again, inbox)).toEqual({ draw: 2, keep: 1, times: 2 });
        expect(cardDraw(photo, inbox)).toEqual({ draw: 1, keep: 1, times: 1 });

        // Late: no cards
        const late = { ...first, answeredAt: T0 + 6 * 60_000 };
        expect(answeredLate(late)).toBe(true);
        expect(cardDraw(late, [late])).toBeUndefined();
    });

    it("knows when late answers stopped the hiding time", () => {
        const sentLate: HiderInboxEntry = {
            key: 1,
            question: radar(1),
            askedAt: T0,
            receivedAt: T0,
            answeredAt: T0 + 8 * 60_000,
        };
        const inTime: HiderInboxEntry = {
            ...sentLate,
            key: 2,
            answeredAt: T0 + 4 * 60_000,
        };
        const stillOpen: HiderInboxEntry = {
            key: 3,
            photo: PHOTO_DECK[0].id,
            askedAt: T0 + 20 * 60_000,
            receivedAt: T0 + 20 * 60_000,
        };

        expect(
            lateIntervals([sentLate, inTime, stillOpen], T0 + 35 * 60_000),
        ).toEqual([
            { from: T0 + 5 * 60_000, to: T0 + 8 * 60_000 },
            { from: T0 + 30 * 60_000, to: T0 + 35 * 60_000 },
        ]);
    });
});
