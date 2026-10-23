import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { overpassCustomHost } from "@/lib/context";
import { memoizeAsync } from "@/lib/utils";
import { getOverpassData, OverpassError } from "@/maps/api";
import { MATCHING_DECK, MEASURING_DECK } from "@/maps/deck";
import { DECK_PLACE_KINDS } from "@/maps/preload";

describe("memoizeAsync", () => {
    it("keeps results but forgets failures", async () => {
        let calls = 0;
        let fail = true;
        const load = memoizeAsync(
            async (x: number) => {
                calls++;
                if (fail) throw new Error("server down");
                return x * 2;
            },
            (x) => String(x),
        );

        await expect(load(2)).rejects.toThrow("server down");
        fail = false;
        expect(await load(2)).toBe(4);
        expect(await load(2)).toBe(4);
        expect(calls).toBe(2);
    });
});

// A minimal Cache API, as in the browser
const cacheStores = new Map<string, Map<string, Response>>();
const cacheStorage = {
    open: async (name: string) => {
        const store = cacheStores.get(name) ?? new Map<string, Response>();
        cacheStores.set(name, store);
        return {
            match: async (url: string) => store.get(url)?.clone(),
            put: async (url: string, response: Response) => {
                store.set(url, response);
            },
            delete: async (url: string) => store.delete(url),
            keys: async () => [...store.keys()],
        };
    },
};
vi.stubGlobal("caches", cacheStorage);

const MAIN = "https://main.example/api/interpreter";

describe("getOverpassData", () => {
    beforeEach(() => {
        overpassCustomHost.set(MAIN);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.stubGlobal("caches", cacheStorage);
        vi.useRealTimers();
    });

    const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status });

    it("returns the data of the first server that answers", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => json({ elements: [{ id: 1 }] })),
        );
        expect(await getOverpassData("[out:json];node(1);out;")).toEqual({
            elements: [{ id: 1 }],
        });
    });

    it("fails instead of pretending there is nothing when all servers fail", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response("busy", { status: 504 })),
        );
        await expect(
            getOverpassData("[out:json];node(2);out;"),
        ).rejects.toBeInstanceOf(OverpassError);
    });

    it("treats a server timeout remark as a failure", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                json({
                    elements: [],
                    remark: 'runtime error: Query timed out in "query" at line 3 after 61 seconds.',
                }),
            ),
        );
        await expect(
            getOverpassData("[out:json];node(3);out;"),
        ).rejects.toBeInstanceOf(OverpassError);

        // Not kept in the cache: asking again loads it again
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => json({ elements: [{ id: 3 }] })),
        );
        expect(await getOverpassData("[out:json];node(3);out;")).toEqual({
            elements: [{ id: 3 }],
        });
    });

    it("waits for a busy server instead of switching servers", async () => {
        vi.useFakeTimers();
        const fetch = vi
            .fn()
            .mockResolvedValueOnce(json({ error: "concurrency_limit" }, 429))
            .mockResolvedValue(json({ elements: [{ id: 5 }] }));
        vi.stubGlobal("fetch", fetch);

        const result = getOverpassData("[out:json];node(5);out;");
        await vi.advanceTimersByTimeAsync(2_000);
        expect(await result).toEqual({ elements: [{ id: 5 }] });
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch.mock.calls[1][0]).toBe(fetch.mock.calls[0][0]);
    });

    it("asks the server at /interpreter, also when the address lacks it", async () => {
        overpassCustomHost.set("https://overpass.example/v1/key_one/");
        const fetch = vi.fn(async () => json({ elements: [{ id: 6 }] }));
        vi.stubGlobal("fetch", fetch);
        expect(await getOverpassData("[out:json];node(6);out;")).toEqual({
            elements: [{ id: 6 }],
        });
        expect(String((fetch.mock.calls[0] as unknown[])[0])).toMatch(
            /^https:\/\/overpass\.example\/v1\/key_one\/interpreter\?data=/,
        );
    });

    it("asks the public servers without an own access", async () => {
        overpassCustomHost.set("");
        const fetch = vi.fn(async () => json({ elements: [{ id: 8 }] }));
        vi.stubGlobal("fetch", fetch);
        expect(await getOverpassData("[out:json];node(8);out;")).toEqual({
            elements: [{ id: 8 }],
        });
        expect(String((fetch.mock.calls[0] as unknown[])[0])).toMatch(
            /^https:\/\/maps\.mail\.ru\//,
        );
    });

    it("falls back on the public servers when the own access is refused", async () => {
        const refusing = "https://refusing.example/api/interpreter";
        overpassCustomHost.set(refusing);
        const fetch = vi.fn(async (url: string) =>
            url.startsWith(refusing)
                ? json({ error: "account_suspended" }, 403)
                : json({ elements: [{ id: 9 }] }),
        );
        vi.stubGlobal("fetch", fetch);
        expect(await getOverpassData("[out:json];node(9);out;")).toEqual({
            elements: [{ id: 9 }],
        });
        expect(fetch).toHaveBeenCalledTimes(2);

        // Not asked again until the app is opened again
        expect(await getOverpassData("[out:json];node(10);out;")).toEqual({
            elements: [{ id: 9 }],
        });
        expect(fetch).toHaveBeenCalledTimes(3);
        expect(String(fetch.mock.calls[2][0])).toMatch(
            /^https:\/\/maps\.mail\.ru\//,
        );
    });

    it("gives up on servers that never answer", async () => {
        vi.useFakeTimers();
        vi.stubGlobal(
            "fetch",
            vi.fn(() => new Promise<Response>(() => {})),
        );
        const result = getOverpassData("[out:json];node(4);out;");
        const assertion = expect(result).rejects.toBeInstanceOf(OverpassError);
        await vi.advanceTimersByTimeAsync(60_000);
        await assertion;
    });
});

describe("preloading", () => {
    it("loads the places of every card in the Small deck", () => {
        const kinds = [...MATCHING_DECK, ...MEASURING_DECK]
            .map((card) => card.type)
            .filter((type) => type?.endsWith("-full"))
            .map((type) => type!.replace(/-full$/, ""));
        expect(new Set(DECK_PLACE_KINDS)).toEqual(new Set(kinds));
        expect(DECK_PLACE_KINDS).toContain("park");
        expect(DECK_PLACE_KINDS).toContain("museum");
    });
});
