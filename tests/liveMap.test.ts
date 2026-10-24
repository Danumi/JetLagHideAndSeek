import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    addQuestion,
    disabledStations,
    hiderMode,
    keptZonesRuledOut,
    photoQuestions,
    questions,
    thermometerRun,
} from "@/lib/context";
import { gameKeys, seal } from "@/lib/live";
import {
    anotherPhoneAsks,
    askingPhone,
    askOnThisPhone,
    isEmptyMap,
    itemChanges,
    questionItem,
    readSeekerMap,
    type SeekerMap,
    seekerMapItems,
    type SeekerMapLink,
    seekerMapNotice,
    seekerMapRole,
    seekerMapRoleFor,
    shareSeekerMap,
    startSeekerMap,
    watchingView,
} from "@/lib/liveMap";
import { type Question, questionSchema } from "@/maps/schema";

const T0 = new Date(2026, 9, 24, 14, 0, 0).getTime();

const radar = (key: number, data: Record<string, unknown> = {}) =>
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
            ...data,
        },
    });

const museum = (key: number) =>
    questionSchema.parse({
        id: "matching",
        key,
        data: {
            lat: 48.2051234567,
            lng: 16.3712345678,
            type: "museum",
            status: "answered",
            same: false,
            askedAt: T0,
            sentAt: T0 + 60_000,
            accuracy: 12.3456,
        },
    });

const emptyMap = (): SeekerMap => ({
    questions: [],
    photos: [],
    disabled: [],
    kept: [],
    thermometer: null,
});

describe("the seekers' map in the database", () => {
    it("comes back as it was, questions in their order", () => {
        const map: SeekerMap = {
            ...emptyMap(),
            questions: [museum(0.25), radar(0.75)],
            disabled: ["node/1", "node/2"],
            kept: ["node/2"],
            photos: [
                {
                    key: 0.5,
                    photo: "tallest-building",
                    askedAt: T0,
                    status: "pending",
                },
            ],
            thermometer: { latA: 48.2, lngA: 16.37, kilometers: 1 },
        };
        const items = seekerMapItems({ by: "phoneA", at: T0, map });
        expect(Object.keys(items)).toEqual([
            "q0_25",
            "q0_75",
            "zones",
            "state",
        ]);
        expect(readSeekerMap(JSON.parse(JSON.stringify(items)))).toEqual({
            by: "phoneA",
            at: T0,
            map,
        });
    });

    it("names questions without dots", () => {
        expect(questionItem(0.123456789)).toBe("q0_123456789");
        expect(questionItem(1761300000000)).toBe("q1761300000000");
    });

    it("leaves out a question that didn't arrive", () => {
        const items = seekerMapItems({
            by: "",
            at: T0,
            map: { ...emptyMap(), questions: [museum(0.25), radar(0.75)] },
        });
        delete items.q0_25;
        expect(
            readSeekerMap(items)?.map.questions.map((question) => question.key),
        ).toEqual([0.75]);
        expect(readSeekerMap({})).toBeNull();
        expect(readSeekerMap({ state: "junk" })).toBeNull();
    });

    it("only writes what changed, the state last and removals after it", () => {
        const before = seekerMapItems({
            by: "phoneA",
            at: T0,
            map: { ...emptyMap(), questions: [museum(0.25), radar(0.75)] },
        });
        const answered = radar(0.75, { status: "answered", within: false });
        const after = seekerMapItems({
            by: "phoneA",
            at: T0 + 1,
            map: { ...emptyMap(), questions: [answered] },
        });
        const changes = itemChanges(before, after);
        expect(Object.keys(changes)).toEqual(["q0_75", "state", "q0_25"]);
        expect(changes.q0_25).toBeNull();
        expect(itemChanges(after, after)).toEqual({});
    });

    it("keeps every item far below the database's 10,000 characters", async () => {
        const { key } = await gameKeys("abcdefghijklmnopqrstuv");
        const zones = Array.from({ length: 109 }, (_, i) => `node/${i}${T0}`);
        const map: SeekerMap = {
            questions: Array.from({ length: 30 }, (_, i) =>
                i % 2 ? museum(Math.random()) : radar(Math.random()),
            ),
            photos: Array.from({ length: 6 }, (_, i) => ({
                key: Math.random(),
                photo: `photo-${i}`,
                askedAt: T0,
                sentAt: T0,
                status: "answered" as const,
            })),
            disabled: zones,
            kept: zones,
            thermometer: {
                latA: 48.21234567,
                lngA: 16.37123456,
                accuracyA: 8.123,
                kilometers: 5,
                toldAt: T0,
            },
        };
        const items = seekerMapItems({ by: "phone-id-12", at: T0, map });
        for (const value of Object.values(items)) {
            expect((await seal(key, value)).length).toBeLessThan(8_000);
        }
    });

    it("lets no pin be moved on a phone that only shows the map", () => {
        const open = radar(0.75, { drag: true });
        const logged = museum(0.25);
        logged.data.drag = false;
        const map = { ...emptyMap(), questions: [open, logged] };
        const view = watchingView(map);
        expect(view.questions.every((question) => !question.data.drag)).toBe(
            true,
        );
        expect(open.data.drag).toBe(true);
        expect(view.questions[1]).toBe(map.questions[1]);
    });

    it("knows who asks", () => {
        expect(seekerMapRoleFor("", "phoneA")).toBe("open");
        expect(seekerMapRoleFor("phoneA", "phoneA")).toBe("asking");
        expect(seekerMapRoleFor("phoneB", "phoneA")).toBe("watching");
        expect(isEmptyMap(emptyMap())).toBe(true);
        expect(isEmptyMap({ ...emptyMap(), disabled: ["node/1"] })).toBe(false);
    });
});

/** A database with this phone's connection to it. */
const fakeDatabase = () => {
    let items: Record<string, unknown> = {};
    let queue = Promise.resolve();
    let offline = false;
    const link: SeekerMapLink = {
        me: "phoneA",
        read: async () => structuredClone(items),
        write: async (changes) => {
            if (offline) throw new Error("offline");
            const next = { ...items };
            for (const [item, value] of Object.entries(changes)) {
                if (value === null) delete next[item];
                else next[item] = structuredClone(value);
            }
            items = next;
        },
        run: (task) => {
            queue = queue.then(task).catch(() => undefined);
        },
    };
    return {
        link,
        shared: () => readSeekerMap(items),
        /** Another phone wrote this map. */
        put: (by: string, at: number, map: SeekerMap) => {
            items = seekerMapItems({ by, at, map });
        },
        /** Another phone wrote these items, and nothing else. */
        putItems: (more: Record<string, unknown>) => {
            items = { ...items, ...more };
        },
        items: () => items,
        setOffline: (value: boolean) => {
            offline = value;
        },
        /** Until the connection did everything it was given. */
        idle: async () => {
            let last;
            do {
                last = queue;
                await last;
            } while (last !== queue);
            // A change undone on a watching phone waits for the rest of it
            await new Promise((resolve) => setTimeout(resolve, 5));
        },
    };
};

describe("sharing the seekers' map", () => {
    let stop: (() => void) | null = null;
    const share = (link: SeekerMapLink) => {
        const sharing = shareSeekerMap(link);
        stop = sharing.stop;
        return sharing;
    };

    beforeEach(() => {
        hiderMode.set(false);
        questions.set([]);
        photoQuestions.set([]);
        disabledStations.set([]);
        keptZonesRuledOut.set([]);
        thermometerRun.set(null);
        seekerMapNotice.set(null);
        startSeekerMap(false);
    });

    afterEach(() => {
        stop?.();
        stop = null;
    });

    it("makes the first phone that asks a question the asking phone", async () => {
        const database = fakeDatabase();
        const sharing = share(database.link);
        await sharing.sync();
        expect(seekerMapRole.get()).toBe("open");
        expect(database.shared()?.by).toBe("");

        addQuestion(radar(0.75));
        await database.idle();
        expect(seekerMapRole.get()).toBe("asking");
        expect(database.shared()?.by).toBe("phoneA");
        expect(database.shared()?.map.questions).toEqual(questions.get());
    });

    it("shows another phone's map and undoes changes to it", async () => {
        const database = fakeDatabase();
        database.put("phoneB", T0, {
            ...emptyMap(),
            questions: [radar(0.75, { drag: true })],
            disabled: ["node/1"],
        });
        const sharing = share(database.link);
        await sharing.sync();
        expect(seekerMapRole.get()).toBe("watching");
        expect(seekerMapNotice.get()?.notice).toBe("watching");
        expect(questions.get().map((question) => question.key)).toEqual([0.75]);
        expect(questions.get()[0].data.drag).toBe(false);
        expect(disabledStations.get()).toEqual(["node/1"]);
        expect(anotherPhoneAsks()).toBe(true);

        disabledStations.set([]);
        (questions.get()[0] as Question & { id: "radius" }).data.within = true;
        questions.set([...questions.get()]);
        await database.idle();
        expect(disabledStations.get()).toEqual(["node/1"]);
        expect(questions.get()[0].data.status).toBe("pending");
        expect(seekerMapNotice.get()?.notice).toBe("blocked");
        expect(database.shared()?.by).toBe("phoneB");
    });

    it("takes over with “Ask on this phone”", async () => {
        const database = fakeDatabase();
        database.put("phoneB", T0, {
            ...emptyMap(),
            questions: [radar(0.75, { drag: true })],
        });
        const sharing = share(database.link);
        await sharing.sync();

        askOnThisPhone();
        expect(seekerMapRole.get()).toBe("asking");
        expect(seekerMapNotice.get()?.notice).toBe("asking");
        // As the other phone had it: its pin can be moved again
        expect(questions.get()[0].data.drag).toBe(true);
        await database.idle();
        expect(database.shared()?.by).toBe("phoneA");
        expect(anotherPhoneAsks()).toBe(false);

        // The other phone takes it back
        database.put("phoneB", Date.now() + 1000, {
            ...emptyMap(),
            questions: [radar(0.75), museum(0.25)],
        });
        await sharing.sync();
        expect(seekerMapRole.get()).toBe("watching");
        expect(seekerMapNotice.get()?.notice).toBe("lost");
        expect(questions.get()).toHaveLength(2);
    });

    it("sends what changed while the database didn't hear from it", async () => {
        const database = fakeDatabase();
        database.put("phoneA", T0, emptyMap());
        askingPhone.set("phoneA");
        const sharing = share(database.link);
        await sharing.sync();
        expect(seekerMapRole.get()).toBe("asking");

        disabledStations.set(["node/7"]);
        await database.idle();
        expect(database.shared()?.map.disabled).toEqual(["node/7"]);
        expect(database.shared()!.at).toBeGreaterThan(T0);
    });

    it("sends a question changed in place right after it was asked", async () => {
        const database = fakeDatabase();
        const sharing = share(database.link);
        await sharing.sync();

        addQuestion(radar(0.75));
        await database.idle();
        // The seekers' line, say: changed in the question itself
        (questions.get()[0] as Question & { id: "radius" }).data.radius = 5;
        questions.set([...questions.get()]);
        await database.idle();
        const shared = database.shared()!.map.questions[0];
        expect((shared as Question & { id: "radius" }).data.radius).toBe(5);
    });

    it("lets the next phone ask once the asking phone is the hider's", async () => {
        const database = fakeDatabase();
        const sharing = share(database.link);
        await sharing.sync();
        addQuestion(radar(0.75));
        await database.idle();
        expect(database.shared()?.by).toBe("phoneA");

        hiderMode.set({ latitude: 48.2, longitude: 16.37 });
        await database.idle();
        expect(seekerMapRole.get()).toBe("off");
        expect(database.shared()?.by).toBe("");
        expect(database.shared()?.map.questions).toHaveLength(1);
    });

    it("leaves the hider's own map alone", async () => {
        const database = fakeDatabase();
        database.put("phoneB", T0, {
            ...emptyMap(),
            questions: [radar(0.75)],
        });
        hiderMode.set({ latitude: 48.2, longitude: 16.37 });
        const sharing = share(database.link);
        await sharing.sync();
        expect(seekerMapRole.get()).toBe("off");
        expect(questions.get()).toEqual([]);

        addQuestion(museum(0.25));
        await database.idle();
        expect(questions.get()).toHaveLength(1);
        expect(database.shared()?.map.questions).toHaveLength(1);
        expect(database.shared()?.by).toBe("phoneB");
    });

    it("adds a question another phone asked at the same moment", async () => {
        const database = fakeDatabase();
        const sharing = share(database.link);
        await sharing.sync();
        addQuestion(radar(0.75));
        await database.idle();
        expect(database.shared()?.by).toBe("phoneA");

        // Another phone's first question, whose map lost to this one's
        database.putItems({ [questionItem(0.25)]: museum(0.25) });
        await sharing.sync();
        await database.idle();
        expect(questions.get().map((question) => question.key)).toEqual([
            0.75, 0.25,
        ]);
        expect(
            database.shared()?.map.questions.map((question) => question.key),
        ).toEqual([0.75, 0.25]);
    });

    it("keeps its own map when it wins after all", async () => {
        const database = fakeDatabase();
        const sharing = share(database.link);
        await sharing.sync();
        addQuestion(radar(0.75));
        await database.idle();
        const mine = database.items();

        // The other phone's map came first: this one shows it for a moment…
        database.put("phoneB", Date.now() + 1000, {
            ...emptyMap(),
            questions: [museum(0.25)],
        });
        await sharing.sync();
        expect(seekerMapRole.get()).toBe("watching");
        // …then this phone's arrives after it and is the game's
        database.putItems({ ...mine, [questionItem(0.25)]: museum(0.25) });
        await sharing.sync();
        await database.idle();
        expect(seekerMapRole.get()).toBe("asking");
        expect(
            database.shared()?.map.questions.map((question) => question.key),
        ).toEqual([0.75, 0.25]);
        expect(questions.get().map((question) => question.key)).toEqual([
            0.75, 0.25,
        ]);
    });

    it("hands over what it asked offline to the phone that took over", async () => {
        const database = fakeDatabase();
        const sharing = share(database.link);
        await sharing.sync();
        addQuestion(radar(0.75));
        await database.idle();

        // In a tunnel: the next question doesn't reach the database
        database.setOffline(true);
        addQuestion(museum(0.25));
        await database.idle();
        expect(database.shared()?.map.questions).toHaveLength(1);

        // Meanwhile another phone took over with what it knew
        database.setOffline(false);
        database.put("phoneB", Date.now() + 1000, {
            ...emptyMap(),
            questions: [radar(0.75)],
        });
        await sharing.sync();
        await database.idle();
        expect(seekerMapRole.get()).toBe("watching");
        expect(seekerMapNotice.get()?.notice).toBe("handedOver");
        // Waiting in the database for the asking phone to add it
        expect(
            (database.items()[questionItem(0.25)] as Question | undefined)?.id,
        ).toBe("matching");
        expect(questions.get().map((question) => question.key)).toEqual([0.75]);
    });

    it("doesn't hand over old questions of a phone that joins", async () => {
        addQuestion(museum(0.25));
        const database = fakeDatabase();
        database.put("phoneB", T0, {
            ...emptyMap(),
            questions: [radar(0.75)],
        });
        const sharing = share(database.link);
        await sharing.sync();
        await database.idle();
        expect(seekerMapRole.get()).toBe("watching");
        expect(database.items()[questionItem(0.25)]).toBeUndefined();
    });
});
