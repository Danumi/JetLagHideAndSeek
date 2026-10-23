/*
 * The map data package: the answers to the Overpass queries of a game in
 * Vienna, loaded once a week by GitHub (scripts/map-data.mjs, run by
 * .github/workflows/update-map-data.yml) and published with the app under
 * map-data/. A phone takes an answer from there before it asks an Overpass
 * server, so the game needs neither a key nor a public server that answers.
 * Queries the package doesn't have (e.g. the nearest street) still go to the
 * servers.
 */

const PACKAGE_URL = `${import.meta.env.BASE_URL.replace(/\/?$/, "/")}map-data/`;

/**
 * The name of a query's answer in the package: the start of the SHA-256 hash
 * of the query. scripts/map-data.mjs names the files the same way.
 */
export const packageKey = async (query: string) => {
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(query),
    );
    return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 32);
};

/** How long a query waits for the package before it asks the servers. */
const INDEX_TIMEOUT_MS = 10_000;
const ANSWER_TIMEOUT_MS = 60_000;

/** The queries the package has answers for, or null if there is none. */
let packageKeys: Promise<Set<string> | null> | undefined;

const loadPackageKeys = async () => {
    // Revalidated, so a new package is used as soon as it is published
    const response = await fetch(`${PACKAGE_URL}index.json`, {
        cache: "no-cache",
        signal: AbortSignal.timeout(INDEX_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const index = await response.json();
    return Array.isArray(index?.keys) ? new Set<string>(index.keys) : null;
};

/** The answer to a query from the package, or null if it has none. */
export const packagedResponse = async (
    query: string,
): Promise<Response | null> => {
    if (typeof fetch === "undefined" || !crypto?.subtle) return null;
    try {
        packageKeys ??= loadPackageKeys();
        const keys = await packageKeys;
        const key = await packageKey(query);
        if (!keys?.has(key)) return null;
        const response = await fetch(`${PACKAGE_URL}${key}.json`, {
            signal: AbortSignal.timeout(ANSWER_TIMEOUT_MS),
        });
        return response.ok ? response : null;
    } catch {
        // Offline or no package: look again with the next query
        packageKeys = undefined;
        return null;
    }
};
