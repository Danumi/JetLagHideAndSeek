import { describe, expect, it } from "vitest";

import { overpassCustomHost } from "@/lib/context";
import {
    interpreterUrl,
    overpassHosts,
    overpassSetupLink,
    readOverpassSetup,
    refuseOverpassHost,
    saveOverpassSetup,
} from "@/lib/overpassAccess";
import { PUBLIC_OVERPASS_HOSTS } from "@/maps/api/constants";

const APP = "https://danumi.github.io/JetLagHideAndSeek/";
const ACCESS = "https://overpass.example/v1/key_one/interpreter";
const OTHER = "https://overpass.example/v1/key_two/interpreter";

const linkWith = (list: unknown[]) =>
    `${APP}#overpass=${btoa(JSON.stringify(list))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")}`;

describe("Overpass access", () => {
    it("asks the server at /interpreter", () => {
        expect(interpreterUrl(ACCESS)).toBe(ACCESS);
        expect(interpreterUrl(` ${ACCESS} `)).toBe(ACCESS);
        expect(interpreterUrl("https://overpass.example/v1/key_one/")).toBe(
            ACCESS,
        );
        expect(interpreterUrl("https://overpass.example/v1/key_one")).toBe(
            ACCESS,
        );
        expect(interpreterUrl("")).toBe("");
    });

    it("asks its own access first, then the public servers", () => {
        saveOverpassSetup("");
        expect(overpassHosts()).toEqual(PUBLIC_OVERPASS_HOSTS);
        saveOverpassSetup(ACCESS);
        expect(overpassHosts()).toEqual([ACCESS, ...PUBLIC_OVERPASS_HOSTS]);
    });

    it("skips an own access that refused, but never a public server", () => {
        const refusing = "https://refusing.example/x/interpreter";
        saveOverpassSetup(refusing);
        refuseOverpassHost(`${refusing}?data=node`);
        refuseOverpassHost(`${PUBLIC_OVERPASS_HOSTS[0]}?data=node`);
        expect(overpassHosts()).toEqual(PUBLIC_OVERPASS_HOSTS);
    });
});

describe("setup link", () => {
    it("carries the access after the #, not in the visible address", () => {
        const link = overpassSetupLink(ACCESS, `${APP}?ask=abc`);
        const url = new URL(link);
        expect(url.origin + url.pathname).toBe(APP);
        expect(url.search).toBe("");
        expect(url.hash).toMatch(/^#overpass=[A-Za-z0-9_-]+$/);
        expect(link).not.toContain("key_one");
        expect(readOverpassSetup(link)).toBe(ACCESS);
    });

    it("still reads the first links, which also carried a fallback", () => {
        expect(readOverpassSetup(linkWith([ACCESS, OTHER]))).toBe(ACCESS);
    });

    it("is found in pasted text and in the address bar", () => {
        const link = overpassSetupLink(ACCESS, APP);
        expect(readOverpassSetup(`Here you go: ${link} have fun`)).toBe(ACCESS);
        expect(readOverpassSetup(new URL(link).hash)).toBe(ACCESS);
    });

    it("ignores anything that is not a setup link", () => {
        expect(readOverpassSetup(ACCESS)).toBeNull();
        expect(readOverpassSetup(`${APP}#overpass=`)).toBeNull();
        expect(readOverpassSetup(`${APP}#overpass=bm9wZQ`)).toBeNull();
        expect(readOverpassSetup(`${APP}#overpass=%%%`)).toBeNull();
    });

    it("only takes web addresses", () => {
        expect(
            readOverpassSetup(linkWith(["javascript:alert(1)", 42, ACCESS])),
        ).toBe(ACCESS);
        expect(readOverpassSetup(linkWith(["javascript:alert(1)"]))).toBeNull();
    });

    it("saves the access on this phone", () => {
        saveOverpassSetup(ACCESS);
        expect(overpassCustomHost.get()).toBe(ACCESS);
    });
});
