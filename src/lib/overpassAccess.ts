import { overpassCustomHost, overpassFallbackHost } from "@/lib/context";

/*
 * The map data comes from an Overpass server the players bring themselves
 * (e.g. a key for overpass.ch), never from public servers and never from the
 * repo. One phone hands its access to the others with a setup link: the
 * access sits in the part after "#", which the browser never sends to a
 * server. Anyone with the link can use the access.
 */

/** In the address: https://…/JetLagHideAndSeek/#overpass=… */
const SETUP_PARAM = "overpass";

/** The main access and the fallback. */
const MAX_HOSTS = 2;

/** The servers to ask, in order: the access, then the fallback. */
export const overpassBaseUrls = (main: string, fallback: string) =>
    [...new Set([main.trim(), fallback.trim()])].filter(Boolean);

/** The servers this phone asks for map data, in order. */
export const overpassHosts = () => {
    takeSetupFromAddress();
    return overpassBaseUrls(
        overpassCustomHost.get(),
        overpassFallbackHost.get(),
    );
};

/** A web address, cleaned up, or null for anything else. */
const asHost = (text: unknown) => {
    if (typeof text !== "string") return null;
    try {
        const url = new URL(text.trim());
        return url.protocol === "https:" || url.protocol === "http:"
            ? url.toString()
            : null;
    } catch {
        return null;
    }
};

const toBase64Url = (text: string) =>
    btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromBase64Url = (code: string) =>
    atob(code.replace(/-/g, "+").replace(/_/g, "/"));

/** A link that saves these accesses on the phone that opens it. */
export const overpassSetupLink = (hosts: string[], appUrl: string) => {
    const valid = hosts
        .map(asHost)
        .filter((host) => host !== null)
        .slice(0, MAX_HOSTS);
    const url = new URL(appUrl);
    url.search = "";
    url.hash = `${SETUP_PARAM}=${toBase64Url(JSON.stringify(valid))}`;
    return url.toString();
};

/**
 * The accesses in a setup link (or in anything pasted that contains one), or
 * null if there is none.
 */
export const readOverpassSetup = (text: string): string[] | null => {
    const code = text.match(
        new RegExp(`[#&?]${SETUP_PARAM}=([A-Za-z0-9_-]+)`),
    )?.[1];
    if (!code) return null;
    try {
        const list = JSON.parse(fromBase64Url(code));
        if (!Array.isArray(list)) return null;
        const hosts = list
            .map(asHost)
            .filter((host) => host !== null)
            .slice(0, MAX_HOSTS);
        return hosts.length > 0 ? hosts : null;
    } catch {
        return null;
    }
};

/** Saves the accesses of a setup link on this phone. */
export const saveOverpassSetup = (hosts: string[]) => {
    overpassCustomHost.set(hosts[0] ?? "");
    overpassFallbackHost.set(hosts[1] ?? "");
};

/** Saves the accesses of a setup link the app was opened with. */
const saveSetupFromAddress = () => {
    if (typeof window === "undefined") return 0;
    const hosts = readOverpassSetup(window.location.hash);
    if (!hosts) return 0;
    saveOverpassSetup(hosts);
    // Out of the address bar, so it isn't shared or bookmarked by accident
    window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
    );
    return hosts.length;
};

let savedFromAddress: number | undefined;

/**
 * Saves the accesses of a setup link in the address, once: when the app
 * opens or before the first query for map data, whichever comes first. The
 * number of saved accesses, 0 without a link.
 */
export const takeSetupFromAddress = () => {
    savedFromAddress ??= saveSetupFromAddress();
    return savedFromAddress;
};
