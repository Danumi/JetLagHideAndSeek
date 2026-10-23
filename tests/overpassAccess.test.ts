import { describe, expect, it } from "vitest";

import { overpassCustomHost, overpassFallbackHost } from "@/lib/context";
import {
    overpassBaseUrls,
    overpassHosts,
    overpassSetupLink,
    readOverpassSetup,
    saveOverpassSetup,
} from "@/lib/overpassAccess";

const APP = "https://danumi.github.io/JetLagHideAndSeek/";
const MAIN = "https://overpass.example/v1/key_one/interpreter";
const FALLBACK = "https://overpass.example/v1/key_two/interpreter";

describe("Overpass access", () => {
    it("asks the access first, then the fallback", () => {
        expect(overpassBaseUrls(MAIN, FALLBACK)).toEqual([MAIN, FALLBACK]);
        expect(overpassBaseUrls(` ${MAIN} `, "")).toEqual([MAIN]);
        expect(overpassBaseUrls("", FALLBACK)).toEqual([FALLBACK]);
        expect(overpassBaseUrls(MAIN, MAIN)).toEqual([MAIN]);
        expect(overpassBaseUrls("", "")).toEqual([]);
    });

    it("has no public servers to fall back on", () => {
        saveOverpassSetup([]);
        expect(overpassHosts()).toEqual([]);
    });
});

describe("setup link", () => {
    it("carries both accesses after the #, not in the visible address", () => {
        const link = overpassSetupLink([MAIN, FALLBACK], `${APP}?ask=abc`);
        const url = new URL(link);
        expect(url.origin + url.pathname).toBe(APP);
        expect(url.search).toBe("");
        expect(url.hash).toMatch(/^#overpass=[A-Za-z0-9_-]+$/);
        expect(link).not.toContain("key_one");
        expect(readOverpassSetup(link)).toEqual([MAIN, FALLBACK]);
    });

    it("keeps the order, so half the players can start with the fallback", () => {
        const link = overpassSetupLink([FALLBACK, MAIN], APP);
        expect(readOverpassSetup(link)).toEqual([FALLBACK, MAIN]);
    });

    it("works with one access", () => {
        expect(readOverpassSetup(overpassSetupLink([MAIN], APP))).toEqual([
            MAIN,
        ]);
    });

    it("is found in pasted text and in the address bar", () => {
        const link = overpassSetupLink([MAIN, FALLBACK], APP);
        expect(readOverpassSetup(`Here you go: ${link} have fun`)).toEqual([
            MAIN,
            FALLBACK,
        ]);
        expect(readOverpassSetup(new URL(link).hash)).toEqual([MAIN, FALLBACK]);
    });

    it("ignores anything that is not a setup link", () => {
        expect(readOverpassSetup(MAIN)).toBeNull();
        expect(readOverpassSetup(`${APP}#overpass=`)).toBeNull();
        expect(readOverpassSetup(`${APP}#overpass=bm9wZQ`)).toBeNull();
        expect(readOverpassSetup(`${APP}#overpass=%%%`)).toBeNull();
    });

    it("only takes web addresses", () => {
        const code = btoa(JSON.stringify(["javascript:alert(1)", 42, MAIN]))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
        expect(readOverpassSetup(`${APP}#overpass=${code}`)).toEqual([MAIN]);
    });

    it("saves the accesses on this phone", () => {
        saveOverpassSetup([MAIN, FALLBACK]);
        expect(overpassCustomHost.get()).toBe(MAIN);
        expect(overpassFallbackHost.get()).toBe(FALLBACK);
        expect(overpassHosts()).toEqual([MAIN, FALLBACK]);

        saveOverpassSetup([MAIN]);
        expect(overpassFallbackHost.get()).toBe("");
    });
});
