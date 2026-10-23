import { overpassCustomHost } from "@/lib/context";
import { PUBLIC_OVERPASS_HOSTS } from "@/maps/api/constants";

/*
 * The map data comes from the phone's own Overpass access, if it has one (a
 * key for overpass.ch, never in the repo), then from public servers. One
 * account, one key: overpass.ch allows one account per person and shares its
 * limits between all keys of an account. One phone hands its access to the
 * others with a setup link: the access sits in the part after "#", which the
 * browser never sends to a server. Anyone with the link can use the access.
 */

/** In the address: https://…/JetLagHideAndSeek/#overpass=… */
const SETUP_PARAM = "overpass";

/**
 * Overpass servers answer queries at …/interpreter; the address may be given
 * without it (overpass.ch calls https://api.overpass.ch/v1/<key>/ the base).
 */
export const interpreterUrl = (text: string) => {
    const url = text.trim();
    if (!url) return "";
    return /\/interpreter$/.test(url)
        ? url
        : `${url.replace(/\/+$/, "")}/interpreter`;
};

/** Own accesses that refused a query (e.g. a suspended key) since the app opened. */
const refusedHosts = new Set<string>();

/**
 * Not asking an own access again until the app is opened again, after it
 * refused a query (401/403). The public servers are always asked.
 */
export const refuseOverpassHost = (url: string) => {
    const host = url.split("?")[0];
    if (!PUBLIC_OVERPASS_HOSTS.includes(host)) refusedHosts.add(host);
};

/** The servers this phone asks for map data: its access, then the public ones. */
export const overpassHosts = () => {
    takeSetupFromAddress();
    const url = interpreterUrl(overpassCustomHost.get());
    return [...new Set([url, ...PUBLIC_OVERPASS_HOSTS])].filter(
        (host) => host && !refusedHosts.has(host),
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

/** A link that saves this access on the phone that opens it. */
export const overpassSetupLink = (host: string, appUrl: string) => {
    const url = new URL(appUrl);
    url.search = "";
    // A list, like the first links that also carried a fallback
    url.hash = `${SETUP_PARAM}=${toBase64Url(JSON.stringify([asHost(host)]))}`;
    return url.toString();
};

/**
 * The access in a setup link (or in anything pasted that contains one), or
 * null if there is none.
 */
export const readOverpassSetup = (text: string): string | null => {
    const code = text.match(
        new RegExp(`[#&?]${SETUP_PARAM}=([A-Za-z0-9_-]+)`),
    )?.[1];
    if (!code) return null;
    try {
        const list = JSON.parse(fromBase64Url(code));
        if (!Array.isArray(list)) return null;
        return list.map(asHost).find((host) => host !== null) ?? null;
    } catch {
        return null;
    }
};

/** Saves the access of a setup link on this phone. */
export const saveOverpassSetup = (host: string) => overpassCustomHost.set(host);

/** Saves the access of a setup link the app was opened with. */
const saveSetupFromAddress = () => {
    if (typeof window === "undefined") return false;
    const host = readOverpassSetup(window.location.hash);
    if (!host) return false;
    saveOverpassSetup(host);
    // Out of the address bar, so it isn't shared or bookmarked by accident
    window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
    );
    return true;
};

let savedFromAddress: boolean | undefined;

/**
 * Saves the access of a setup link in the address, once: when the app opens
 * or before the first query for map data, whichever comes first. Whether
 * there was one.
 */
export const takeSetupFromAddress = () => {
    savedFromAddress ??= saveSetupFromAddress();
    return savedFromAddress;
};
