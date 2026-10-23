import {
    type ChatQuestionKind,
    hiderInbox,
    type HiderInboxEntry,
    questions,
} from "@/lib/context";
import { t, tr } from "@/lib/i18n";
import {
    answerOptions,
    questionTitle,
    setAnswer,
    setNoAnswer,
} from "@/maps/answers";
import { ANSWER_MINUTES, PHOTO_ANSWER_MINUTES } from "@/maps/deadline";
import { photoCardFor } from "@/maps/deck";
import type { Interval } from "@/maps/gameClock";
import { photoCardId, questionCardId } from "@/maps/repeats";
import type { Question } from "@/maps/schema";

/*
 * The hider's question log: questions from links and ones added by hand
 * (photos, questions asked in the chat). Each is open until the hider
 * answers, with the time the hider has to answer. Answers to questions from
 * links also go onto the hider's map, so it shows what the seekers know.
 */

export type SentAnswer = NonNullable<HiderInboxEntry["sent"]>;

export const isOpen = (entry: HiderInboxEntry) =>
    entry.answeredAt === undefined;

/** Minutes the hider has to answer this question. */
export const answerMinutes = (entry: { photo?: string }) =>
    entry.photo ? PHOTO_ANSWER_MINUTES : ANSWER_MINUTES;

/** When the answer to this question is due. */
export const answerDue = (entry: HiderInboxEntry) =>
    entry.askedAt + answerMinutes(entry) * 60_000;

/** Answered after it was due: no cards, and the hiding time stood still. */
export const answeredLate = (entry: HiderInboxEntry) =>
    entry.answeredAt !== undefined && entry.answeredAt > answerDue(entry);

/**
 * When the hiding time stands still for late answers: from when each
 * answer was due until the hider sent it, or until now while it's open.
 */
export const lateIntervals = (
    inbox: HiderInboxEntry[],
    now = Date.now(),
): Interval[] =>
    inbox.flatMap((entry) => {
        const from = answerDue(entry);
        const to = entry.answeredAt ?? now;
        return to > from ? [{ from, to }] : [];
    });

/** Cards the hider draws after answering, by the rule book. */
const DRAWS = {
    matching: { draw: 3, keep: 1 },
    measuring: { draw: 3, keep: 1 },
    radius: { draw: 2, keep: 1 },
    thermometer: { draw: 2, keep: 1 },
    tentacles: { draw: 4, keep: 2 },
    photo: { draw: 1, keep: 1 },
};

/** The card a question in the log was asked with, where the app knows it. */
const entryCardId = (entry: HiderInboxEntry) =>
    entry.question
        ? questionCardId(entry.question)
        : entry.photo
          ? photoCardId(entry.photo)
          : undefined;

/**
 * What the hider draws after answering: like "draw 3, keep 1", `times`
 * over for a card asked before (twice the second time). None when the
 * answer was late.
 */
export const cardDraw = (entry: HiderInboxEntry, inbox: HiderInboxEntry[]) => {
    if (answeredLate(entry)) return undefined;
    const kind = entry.question
        ? entry.question.id
        : entry.photo
          ? "photo"
          : entry.kind === "radar"
            ? "radius"
            : (entry.kind ?? "matching");
    const id = entryCardId(entry);
    const before = id
        ? inbox.filter(
              (other) =>
                  other.key !== entry.key &&
                  other.askedAt <= entry.askedAt &&
                  entryCardId(other) === id,
          ).length
        : 0;
    return { ...DRAWS[kind], times: before + 1 };
};

/** "Photo: Tree". */
export const photoTitle = (photo: string) => {
    const card = photoCardFor(photo);
    return t("photo.title", { photo: card ? tr(card.label) : photo });
};

/** The kinds keep their names from the game in both languages. */
export const CHAT_KIND_NAMES: Record<ChatQuestionKind, string> = {
    matching: "Matching",
    measuring: "Measuring",
    radar: "Radar",
    thermometer: "Thermometer",
};

export const entryTitle = (entry: HiderInboxEntry) => {
    if (entry.question) {
        return `${entry.number ? `${entry.number} · ` : ""}${questionTitle(entry.question)}`;
    }
    if (entry.photo) return photoTitle(entry.photo);
    return CHAT_KIND_NAMES[entry.kind ?? "matching"];
};

/** An answer in words, in this phone's language. */
export const answerLabel = (entry: HiderInboxEntry, answer: SentAnswer) => {
    switch (answer.value) {
        case "no-answer":
            return t("answer.none");
        case "photo":
            return t("photo.sent");
        case "answered":
            return t("hider.answered");
    }
    const question = entry.question;
    if (!question) return answer.value;
    if (question.id === "tentacles") {
        return answer.location
            ? String(answer.location.properties?.name ?? t("answer.place"))
            : t("answer.notWithin");
    }
    return (
        answerOptions(question).find((option) => option.value === answer.value)
            ?.label ?? answer.value
    );
};

/** The answer for the seekers' chat, like "Radar 2 km – answer: Inside". */
export const answerMessage = (entry: HiderInboxEntry, answer: SentAnswer) =>
    t("hider.answerMessage", {
        title: entryTitle(entry),
        answer: answerLabel(entry, answer),
    });

const updateEntry = (key: number, change: Partial<HiderInboxEntry>) =>
    hiderInbox.set(
        hiderInbox.get().map((x) => (x.key === key ? { ...x, ...change } : x)),
    );

/**
 * A question from a link. A link opened again keeps the answer the hider
 * gave; while the question is open, the seekers may have changed it.
 */
export const receiveEntry = (entry: HiderInboxEntry) => {
    const existing = hiderInbox.get().find((x) => x.key === entry.key);
    if (!existing) {
        hiderInbox.set([...hiderInbox.get(), entry]);
    } else if (isOpen(existing)) {
        updateEntry(entry.key, {
            ...entry,
            receivedAt: existing.receivedAt,
            workedOut: undefined,
        });
    }
};

/** A question the seekers asked in the chat: the hider adds it by hand. */
export const addEntryByHand = (
    what: { photo: string } | { kind: ChatQuestionKind },
) => {
    const now = Date.now();
    const entry: HiderInboxEntry = {
        key: Math.random(),
        ...what,
        byHand: true,
        askedAt: now,
        receivedAt: now,
    };
    hiderInbox.set([...hiderInbox.get(), entry]);
    return entry;
};

/** The question with the hider's answer, as on the seekers' map. */
const answeredQuestion = (question: Question, sent: SentAnswer) => {
    const answered = structuredClone(question);
    if (sent.value === "no-answer") {
        setNoAnswer(answered);
    } else if (answered.id === "tentacles") {
        answered.data.location = sent.location ?? false;
        answered.data.status = "answered";
        answered.data.drag = false;
    } else {
        setAnswer(answered, sent.value);
    }
    return answered;
};

/**
 * The hider answered: the question leaves the open ones, and the hider's
 * map rules out what the seekers now know.
 */
export const markAnswered = (key: number, sent: SentAnswer) => {
    const entry = hiderInbox.get().find((x) => x.key === key);
    if (!entry) return;
    updateEntry(key, { answeredAt: Date.now(), sent });

    const question = entry.question;
    if (question) {
        questions.set([
            ...questions.get().filter((q) => q.key !== question.key),
            answeredQuestion(question, sent),
        ]);
    }
};

/** Open again, e.g. after a wrong tap: the hider's map forgets the answer. */
export const reopenEntry = (key: number) => {
    updateEntry(key, { answeredAt: undefined, sent: undefined });
    if (questions.get().some((q) => q.key === key)) {
        questions.set(questions.get().filter((q) => q.key !== key));
    }
};

/** Removes a question from the log, and its answer from the hider's map. */
export const removeEntry = (key: number) => {
    hiderInbox.set(hiderInbox.get().filter((x) => x.key !== key));
    if (questions.get().some((q) => q.key === key)) {
        questions.set(questions.get().filter((q) => q.key !== key));
    }
};
