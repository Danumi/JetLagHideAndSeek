import { persistentAtom } from "@nanostores/persistent";
import { atom } from "nanostores";

import {
    disabledStations,
    hiderMode,
    keptZonesRuledOut,
    type PhotoQuestion,
    photoQuestions,
    questions,
    thermometerRun,
} from "@/lib/context";
import { type Questions, questionSchema } from "@/maps/schema";

/*
 * One map for all seekers, on phones connected through live.ts: one
 * seeker's phone asks the questions and enters the answers, the other
 * seekers' phones show the same map (grey area, ruled-out zones, questions)
 * and can't change it. The first seeker's phone that asks a question (or
 * rules out a zone) is the asking phone; "Ask on this phone" on another one
 * takes over, e.g. when its battery runs low. "New Game" on the asking
 * phone empties the map on all of them. The hider's phone keeps its own.
 *
 * Two phones can ask at once: two seekers ask the first question at the
 * same moment, or one takes over while the asking phone is offline. The
 * database keeps the map of the one that wrote last; a question of the
 * other one isn't lost but handed over: it stays in the database as an item
 * of its own (written there, or by the other phone once it hears about the
 * new asking phone), and the asking phone adds it to its map.
 *
 * In the database, kind "seek": `state` (the asking phone, when the map
 * last changed, the order of the questions, photo questions, a running
 * thermometer), `zones` (the ruled-out zones) and one item per question:
 * every item stays far below the database's 10,000 characters, and a change
 * only sends what changed.
 */

const json = { encode: JSON.stringify, decode: JSON.parse };

export type ThermometerRun = NonNullable<ReturnType<typeof thermometerRun.get>>;

/** What all the seekers' phones show. */
export type SeekerMap = {
    questions: Questions;
    photos: PhotoQuestion[];
    /** Ruled-out zones (`disabledStations`, `keptZonesRuledOut`). */
    disabled: string[];
    kept: string[];
    thermometer: ThermometerRun | null;
};

/** The seekers' map as the phones share it. */
export type SharedSeekerMap = {
    /** The phone that asks the questions, or "" before anyone asked. */
    by: string;
    /** When the map last changed, on the phone that changed it. */
    at: number;
    map: SeekerMap;
};

type StateItem = {
    by: string;
    at: number;
    /** The questions' items, in the order of the list. */
    order: string[];
    photos: PhotoQuestion[];
    thermometer: ThermometerRun | null;
};

type ZonesItem = { disabled: string[]; kept: string[] };

const STATE_ITEM = "state";
const ZONES_ITEM = "zones";

/** A question's item: names in the database can't have dots. */
export const questionItem = (key: number) =>
    `q${String(key).replace(/[^A-Za-z0-9_-]/g, "_")}`;

/** The items the database keeps, questions first and the state last. */
export const seekerMapItems = ({
    by,
    at,
    map,
}: SharedSeekerMap): Record<string, unknown> => {
    const items: Record<string, unknown> = {};
    for (const question of map.questions) {
        items[questionItem(question.key)] = question;
    }
    items[ZONES_ITEM] = {
        disabled: map.disabled,
        kept: map.kept,
    } satisfies ZonesItem;
    items[STATE_ITEM] = {
        by,
        at,
        order: map.questions.map((question) => questionItem(question.key)),
        photos: map.photos,
        thermometer: map.thermometer,
    } satisfies StateItem;
    return items;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const strings = (value: unknown) =>
    Array.isArray(value)
        ? value.filter((x): x is string => typeof x === "string")
        : [];

const isPhoto = (value: unknown): value is PhotoQuestion =>
    isObject(value) &&
    typeof value.photo === "string" &&
    Number.isFinite(value.key) &&
    Number.isFinite(value.askedAt);

const isThermometer = (value: unknown): value is ThermometerRun =>
    isObject(value) &&
    ["latA", "lngA", "kilometers"].every((key) => Number.isFinite(value[key]));

/** The seekers' map in the database's items, or null without one. */
export const readSeekerMap = (
    items: Record<string, unknown>,
): SharedSeekerMap | null => {
    const state = items[STATE_ITEM];
    if (
        !isObject(state) ||
        typeof state.by !== "string" ||
        typeof state.at !== "number"
    ) {
        return null;
    }
    const zones = isObject(items[ZONES_ITEM]) ? items[ZONES_ITEM] : {};
    return {
        by: state.by,
        at: state.at,
        map: {
            // One that didn't arrive (or is broken) is left out
            questions: strings(state.order).flatMap((item) => {
                const parsed = questionSchema.safeParse(items[item]);
                return parsed.success ? [parsed.data] : [];
            }),
            photos: Array.isArray(state.photos)
                ? state.photos.filter(isPhoto)
                : [],
            disabled: strings(zones.disabled),
            kept: strings(zones.kept),
            thermometer: isThermometer(state.thermometer)
                ? state.thermometer
                : null,
        },
    };
};

/** What to write to get from the items there to these: null removes one. */
export const itemChanges = (
    there: Record<string, unknown>,
    next: Record<string, unknown>,
) => {
    const changes: Record<string, unknown> = {};
    for (const [item, value] of Object.entries(next)) {
        if (JSON.stringify(there[item]) !== JSON.stringify(value)) {
            changes[item] = value;
        }
    }
    for (const item of Object.keys(there)) {
        if (!(item in next)) changes[item] = null;
    }
    return changes;
};

/** On a phone that only shows the map: no pin can be moved. */
export const watchingView = (map: SeekerMap): SeekerMap => ({
    ...map,
    questions: map.questions.map((question) => {
        if (!question.data.drag) return question;
        const copy = structuredClone(question);
        copy.data.drag = false;
        return copy;
    }),
});

export const isEmptyMap = (map: SeekerMap) =>
    map.questions.length === 0 &&
    map.photos.length === 0 &&
    map.disabled.length === 0 &&
    map.kept.length === 0 &&
    map.thermometer === null;

const mapText = (map: SeekerMap) => JSON.stringify(map);

/**
 * This phone and the seekers' map: it "asks" the questions, it's
 * "watching" the map of the phone that asks, it's "open" (no phone asks
 * yet: the next one to ask a question does) or "off" (not a connected
 * seeker's phone).
 */
export type SeekerMapRole = "off" | "asking" | "watching" | "open";

export const seekerMapRoleFor = (by: string, me: string): SeekerMapRole =>
    by === "" ? "open" : by === me ? "asking" : "watching";

export const seekerMapRole = atom<SeekerMapRole>("off");

/** The phone that asks, as this phone last heard: also while offline. */
export const askingPhone = persistentAtom<string>("liveAskingPhone", "");

/** When this phone's seekers' map last changed, here or on another phone. */
const seekerMapAt = persistentAtom<number>("liveSeekerMapAt", 0, json);

/** What the seekers should know about the map, as a message on the screen. */
export type SeekerMapNotice =
    /** A change on a watching phone, undone. */
    | "blocked"
    /** Another phone asks: this one shows its map. */
    | "watching"
    /** Another phone took over the questions from this one. */
    | "lost"
    /** …and gets the questions this phone asked meanwhile. */
    | "handedOver"
    /** This phone took over. */
    | "asking";

export const seekerMapNotice = atom<{
    notice: SeekerMapNotice;
    at: number;
} | null>(null);

const notify = (notice: SeekerMapNotice) =>
    seekerMapNotice.set({ notice, at: Date.now() });

/**
 * A game started on this phone (its map is the one the others take) or one
 * it joins (it takes the game's map).
 */
export const startSeekerMap = (mine: boolean) => {
    seekerMapAt.set(mine ? Date.now() : 0);
    askingPhone.set("");
};

const localMap = (): SeekerMap => ({
    questions: questions.get(),
    photos: photoQuestions.get(),
    disabled: disabledStations.get(),
    kept: keptZonesRuledOut.get(),
    thermometer: thermometerRun.get(),
});

const setLocalMap = (map: SeekerMap) => {
    const same = (a: unknown, b: unknown) =>
        JSON.stringify(a) === JSON.stringify(b);
    if (!same(questions.get(), map.questions)) questions.set(map.questions);
    if (!same(photoQuestions.get(), map.photos)) photoQuestions.set(map.photos);
    if (!same(disabledStations.get(), map.disabled))
        disabledStations.set(map.disabled);
    if (!same(keptZonesRuledOut.get(), map.kept))
        keptZonesRuledOut.set(map.kept);
    if (!same(thermometerRun.get(), map.thermometer))
        thermometerRun.set(map.thermometer);
};

/** How the connection lets the seekers' map into the database. */
export type SeekerMapLink = {
    /** This phone among the game's phones. */
    me: string;
    /** The seekers' map's items as the database has them, decrypted. */
    read: () => Promise<Record<string, unknown>>;
    /** Writes these items all at once; null removes one. */
    write: (changes: Record<string, unknown>) => Promise<void>;
    /** Runs a task after the connection's others. */
    run: (task: () => Promise<void> | void) => void;
};

let takeOver: (() => void) | null = null;
/** This phone while it shares the seekers' map. */
let sharingPhone: string | null = null;

/** "Ask on this phone": the other seekers' phones show this one's map. */
export const askOnThisPhone = () => takeOver?.();

/**
 * Another phone asks the questions: "New Game" leaves the seekers' map as
 * that phone has it when this phone's player is seeking.
 */
export const anotherPhoneAsks = () =>
    sharingPhone !== null &&
    askingPhone.get() !== "" &&
    askingPhone.get() !== sharingPhone;

/**
 * Shares the seekers' map over a connection, until stopped. `sync` runs
 * whenever the database has news.
 */
export const shareSeekerMap = (link: SeekerMapLink) => {
    let stopped = false;
    let there: Record<string, unknown> = {};
    let shared: SharedSeekerMap | null = null;
    // While another phone's map is shown: not a change of this phone's
    let taking = false;
    let undoing = false;
    let wasSeeker = hiderMode.get() === false;
    // What a watching phone shows, also before the database answered
    let shown: SeekerMap | null =
        askingPhone.get() && askingPhone.get() !== link.me
            ? watchingView(localMap())
            : null;

    const isSeeker = () => hiderMode.get() === false;

    const updateRole = (tell = true) => {
        const next = isSeeker()
            ? seekerMapRoleFor(askingPhone.get(), link.me)
            : "off";
        const previous = seekerMapRole.get();
        seekerMapRole.set(next);
        if (!tell || next === previous) return;
        if (next === "watching") {
            notify(previous === "asking" ? "lost" : "watching");
        }
        if (next === "asking" && previous === "watching") notify("asking");
    };

    const show = (map: SeekerMap) => {
        taking = true;
        try {
            setLocalMap(map);
        } finally {
            taking = false;
        }
    };

    // This phone's questions the database hasn't taken yet (offline, say)
    const unsent = new Set<number>();

    const writeMap = async (by: string, at: number, map: SeekerMap) => {
        const next = seekerMapItems({ by, at, map });
        const changes = itemChanges(there, next);
        if (Object.keys(changes).length === 0) return;
        const questionKeys = map.questions
            .filter((question) => questionItem(question.key) in changes)
            .map((question) => question.key);
        questionKeys.forEach((key) => unsent.add(key));
        await link.write(changes);
        questionKeys.forEach((key) => unsent.delete(key));
        // A copy: a question changed in place (its line, say) must still
        // differ from what the database has
        there = structuredClone(next);
        shared = { by, at, map };
    };

    /**
     * Another phone asks now: the questions it can't know of (asked here
     * while the database didn't take them) go to it as items of their own.
     * How many.
     */
    const handOver = async (map: SeekerMap) => {
        const known = new Set(map.questions.map((question) => question.key));
        const mine = localMap().questions.filter(
            (question) => unsent.has(question.key) && !known.has(question.key),
        );
        unsent.clear();
        if (mine.length === 0) return 0;
        await link.write(
            Object.fromEntries(
                mine.map((question) => [questionItem(question.key), question]),
            ),
        );
        return mine.length;
    };

    /**
     * The asking phone adds questions that are in the database but not on
     * its map: handed over by another phone, or asked there at the same
     * moment as the first question here.
     */
    const adoptHandedOver = async () => {
        const state = there[STATE_ITEM];
        const listed = new Set(
            strings(isObject(state) ? state.order : undefined),
        );
        const local = localMap();
        const here = new Set(
            local.questions.map((question) => questionItem(question.key)),
        );
        const handed = Object.entries(there).flatMap(([item, value]) => {
            if (!item.startsWith("q") || listed.has(item) || here.has(item)) {
                return [];
            }
            const parsed = questionSchema.safeParse(value);
            return parsed.success ? [parsed.data] : [];
        });
        if (handed.length === 0) return;
        show({ ...local, questions: [...local.questions, ...handed] });
        seekerMapAt.set(Math.max(Date.now(), seekerMapAt.get() + 1));
        await send();
    };

    /** This phone's map to the others: it asks from now on, unless it's empty. */
    const send = async () => {
        if (!isSeeker() || seekerMapRole.get() === "watching") return;
        const map = localMap();
        const by =
            askingPhone.get() === link.me || !isEmptyMap(map) ? link.me : "";
        askingPhone.set(by);
        updateRole();
        await writeMap(by, seekerMapAt.get(), map);
    };

    /** The asking phone stops asking (it's the hider's now, or it left). */
    const release = async () => {
        if (askingPhone.get() !== link.me) return;
        askingPhone.set("");
        await writeMap("", Date.now(), localMap());
    };

    const sync = async () => {
        const previous = seekerMapRole.get();
        there = await link.read();
        shared = readSeekerMap(there);
        askingPhone.set(shared?.by ?? "");
        if (!isSeeker()) {
            updateRole();
            shown = null;
            return;
        }
        if (shared && seekerMapRoleFor(shared.by, link.me) === "watching") {
            const handed =
                previous === "watching" ? 0 : await handOver(shared.map);
            updateRole(handed === 0);
            if (handed > 0) notify("handedOver");
            shown = watchingView(shared.map);
            if (mapText(localMap()) !== mapText(shown)) show(shown);
            seekerMapAt.set(shared.at);
            return;
        }
        updateRole();
        shown = null;
        if (shared && previous === "watching" && shared.by === link.me) {
            // Two phones asked at once and this one's map is the game's after
            // all: it's the one in the database, not the one shown meanwhile
            show(shared.map);
            seekerMapAt.set(shared.at);
        }
        const localAt = seekerMapAt.get();
        if (shared && shared.at > localAt) {
            show(shared.map);
            seekerMapAt.set(shared.at);
        } else if (!shared || shared.at < localAt) {
            await send();
        }
        if (seekerMapRole.get() === "asking") await adoptHandedOver();
    };

    /** A change on a watching phone: back to the asking phone's map. */
    const undoChange = () => {
        if (undoing) return;
        undoing = true;
        // After the rest of the change, e.g. "New Game" making it the hider's
        setTimeout(() => {
            undoing = false;
            const view = shown ?? (shared && watchingView(shared.map));
            if (
                stopped ||
                !view ||
                !isSeeker() ||
                seekerMapRole.get() !== "watching" ||
                mapText(localMap()) === mapText(view)
            ) {
                return;
            }
            show(view);
            notify("blocked");
        }, 0);
    };

    const onChange = () => {
        if (taking || stopped || !isSeeker()) return;
        if (seekerMapRole.get() === "watching") return undoChange();
        seekerMapAt.set(Math.max(Date.now(), seekerMapAt.get() + 1));
        link.run(send);
    };

    takeOver = () => {
        if (!isSeeker() || seekerMapRole.get() !== "watching") return;
        // As the asking phone had it: its questions can be changed again
        show(shared?.map ?? localMap());
        shown = null;
        askingPhone.set(link.me);
        seekerMapAt.set(Math.max(Date.now(), seekerMapAt.get() + 1));
        updateRole();
        link.run(send);
    };

    const unlisten = [
        questions.listen(onChange),
        photoQuestions.listen(onChange),
        disabledStations.listen(onChange),
        keptZonesRuledOut.listen(onChange),
        thermometerRun.listen(onChange),
        // Also when the hider's location changes: only a change of role counts
        hiderMode.listen(() => {
            const seeker = isSeeker();
            if (seeker === wasSeeker) return;
            wasSeeker = seeker;
            if (!seeker) link.run(release);
            updateRole();
            if (!seeker) return;
            // Right away: the hider's questions aren't the seekers'
            if (shared && seekerMapRole.get() === "watching") {
                shown = watchingView(shared.map);
                show(shown);
            }
            link.run(sync);
        }),
    ];
    sharingPhone = link.me;
    updateRole(false);

    return {
        sync,
        stop: () => {
            stopped = true;
            unlisten.forEach((stop) => stop());
            takeOver = null;
            sharingPhone = null;
            // The others don't wait for this phone's questions
            if (askingPhone.get() === link.me) {
                release().catch(() => undefined);
            }
            askingPhone.set("");
            seekerMapRole.set("off");
        },
    };
};
