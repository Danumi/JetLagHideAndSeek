/*
 * Builds the map data package (see src/maps/api/mapDataPackage.ts).
 *
 * Opens the built app in a headless browser, lets it preload the map data of
 * a game in Vienna like "New Game" does, and answers its Overpass queries
 * itself: from the own access in OVERPASS_URL (a repository secret), else
 * from public servers, one query at a time, patiently, with retries. So the
 * package has exactly the queries the app asks. Every answer is saved as
 * <out>/<key>.json and listed in <out>/index.json. A query that fails this
 * time keeps its answer from the previous package, if there is one.
 *
 *   node scripts/map-data.mjs --dist dist --out map-data \
 *       [--previous previous-map-data] [--browser /usr/bin/google-chrome]
 *
 * Exits with 0 when the preload finished, 2 when it didn't (the package then
 * holds what there is, filled up from the previous one).
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

import { chromium } from "playwright-core";

const { values: options } = parseArgs({
    options: {
        dist: { type: "string", default: "dist" },
        out: { type: "string", default: "map-data" },
        previous: { type: "string" },
        browser: { type: "string" },
        // Comma-separated, for testing against another server
        servers: { type: "string" },
        minutes: { type: "string", default: "150" },
    },
});

/**
 * Daniel's own Overpass access (overpass.ch, with the key in the address),
 * from the repository secret OVERPASS_URL: never in the repo or the logs.
 */
const OWN_ACCESS = (() => {
    const url = process.env.OVERPASS_URL?.trim();
    if (!url) return null;
    return /\/interpreter$/.test(url)
        ? url
        : `${url.replace(/\/+$/, "")}/interpreter`;
})();

/** Asked in this order: the own access, then the public servers. */
const SERVERS = options.servers?.split(",") ?? [
    ...(OWN_ACCESS ? [OWN_ACCESS] : []),
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
];
/** In the logs: never the address of the own access, it holds the key. */
const serverName = (server) =>
    server === OWN_ACCESS ? "own access" : new URL(server).host;
/**
 * The app's address: overpass.ch only takes the key from there if "Allowed
 * referers" is set for it (danumi.github.io).
 */
const APP_URL = "https://danumi.github.io/JetLagHideAndSeek/";
const USER_AGENT =
    "HideAndSeekVienna-map-data/1.0 (+https://github.com/Danumi/JetLagHideAndSeek)";
/** Rounds over all servers before a query counts as failed. */
const ROUNDS = 4;
/** overpass.ch's free plan takes 30 queries a minute, one at a time. */
const MIN_GAP_MS = 2_500;
const REQUEST_TIMEOUT_MS = 5 * 60_000;
const BASE = "/JetLagHideAndSeek/";
const READY_TEXT = "Map data for the game is ready";
const GIVE_UP_AT = Date.now() + Number(options.minutes) * 60_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...parts) =>
    console.log(new Date().toISOString().slice(11, 19), ...parts);

/** The same name the app looks for (packageKey in mapDataPackage.ts). */
const packageKey = (query) =>
    createHash("sha256").update(query, "utf8").digest("hex").slice(0, 32);

const isRuntimeError = (text) => {
    try {
        const data = JSON.parse(text);
        return (
            typeof data.remark === "string" &&
            /runtime error|timed out|out of memory/i.test(data.remark)
        );
    } catch {
        return true;
    }
};

// --- Asking the servers, one query at a time ---

let queue = Promise.resolve();
const oneAtATime = (job) => {
    const result = queue.then(job);
    queue = result.catch(() => {});
    return result;
};

/** Servers that refused (401/403, e.g. a suspended key): not asked again. */
const refused = new Set();
const lastAsked = new Map();

const askServer = async (server, query) => {
    const wait = (lastAsked.get(server) ?? 0) + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastAsked.set(server, Date.now());
    const started = Date.now();
    try {
        const response = await fetch(server, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": USER_AGENT,
                ...(server === OWN_ACCESS ? { Referer: APP_URL } : {}),
            },
            body: new URLSearchParams({ data: query }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        const text = await response.text();
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        if (response.status === 401 || response.status === 403) {
            refused.add(server);
        }
        if (!response.ok) {
            return { failure: `${response.status} after ${seconds} s` };
        }
        if (isRuntimeError(text)) {
            return { failure: `runtime error after ${seconds} s` };
        }
        return { text, seconds };
    } catch (error) {
        return { failure: `${error.name ?? "error"}: ${error.message}` };
    }
};

let asked = 0;

const fetchPatiently = async (query) => {
    const number = ++asked;
    const key = packageKey(query);
    for (let round = 1; round <= ROUNDS; round++) {
        for (const server of SERVERS) {
            if (refused.has(server)) continue;
            const host = serverName(server);
            const { text, seconds, failure } = await askServer(server, query);
            if (text !== undefined) {
                log(
                    `#${number} ${key} ok from ${host} in ${seconds} s,`,
                    `${Math.round(text.length / 1024)} KB`,
                );
                return text;
            }
            log(`#${number} ${key} ${host}: ${failure}`);
            // Busy or refused: give the servers a moment
            await sleep(/^(429|503|504)/.test(failure) ? 30_000 : 5_000);
        }
        if (round < ROUNDS) await sleep(round * 60_000);
    }
    log(`#${number} ${key} failed on every server`);
    return null;
};

/** Answers by query; a failed query is asked again when the app retries. */
const answers = new Map();
const answer = (query) => {
    if (!answers.has(query)) {
        const result = oneAtATime(() => fetchPatiently(query));
        answers.set(query, result);
        result.then((text) => {
            if (text === null) answers.delete(query);
        });
    }
    return answers.get(query);
};
/** Every query the app asked, with its answer once there is one. */
const results = new Map();
/** Queries the app is waiting for. */
let waiting = 0;

// --- Serving the built app ---

const TYPES = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".geojson": "application/json",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".webmanifest": "application/manifest+json",
    ".woff2": "font/woff2",
};

const serveApp = (dist) =>
    new Promise((resolve) => {
        const server = createServer(async (request, response) => {
            const url = new URL(request.url, "http://localhost");
            let file = decodeURIComponent(url.pathname);
            if (!file.startsWith(BASE)) {
                response.writeHead(404).end();
                return;
            }
            file = file.slice(BASE.length) || "index.html";
            if (file.endsWith("/")) file += "index.html";
            const full = path.join(dist, file);
            // No package while it is being made: the app asks the servers
            if (
                !full.startsWith(path.resolve(dist)) ||
                file.startsWith("map-data/")
            ) {
                response.writeHead(404).end();
                return;
            }
            try {
                const body = await readFile(full);
                response
                    .writeHead(200, {
                        "Content-Type":
                            TYPES[path.extname(full)] ??
                            "application/octet-stream",
                    })
                    .end(body);
            } catch {
                response.writeHead(404).end();
            }
        });
        server.listen(0, "127.0.0.1", () => resolve(server));
    });

// --- Driving the app ---

const preload = async (page) => {
    const appText = () => page.evaluate(() => document.body.innerText);
    await page.getByTitle("Settings", { exact: true }).click();
    await page.getByRole("button", { name: /^Advanced/ }).click();
    await page.getByRole("button", { name: "Preload map data" }).click();
    await page.keyboard.press("Escape");
    log("preloading");

    let quiet = 0;
    while (Date.now() < GIVE_UP_AT) {
        await sleep(500);
        const text = await appText();
        if (text.includes(READY_TEXT)) return true;

        // A query failed in the app (it waits 60 s): once the patient answers
        // are in, "Retry" carries on where the preload stopped
        const retry = page.getByRole("button", { name: "Retry" });
        quiet = waiting > 0 ? 0 : quiet + 1;
        if (quiet > 20 && (await retry.count()) > 0) {
            log("retrying in the app");
            await retry.first().click();
            quiet = 0;
        }
    }
    return false;
};

const main = async () => {
    const dist = path.resolve(options.dist);
    const out = path.resolve(options.out);
    const server = await serveApp(dist);
    const appUrl = `http://127.0.0.1:${server.address().port}${BASE}`;

    const browser = await chromium.launch({
        executablePath: options.browser,
        args: process.env.HTTPS_PROXY
            ? [`--proxy-server=https=${new URL(process.env.HTTPS_PROXY).host}`]
            : [],
    });
    const context = await browser.newContext({
        locale: "en-US",
        serviceWorkers: "block",
        viewport: { width: 390, height: 844 },
    });
    await context.addInitScript(() => {
        if (sessionStorage.getItem("mapData")) return;
        sessionStorage.setItem("mapData", "1");
        localStorage.setItem("guideSeen", "true");
        localStorage.setItem("roleChosen", "true");
        localStorage.setItem("appLanguage", "en");
    });
    await context.route(
        (url) => url.pathname.endsWith("/interpreter"),
        async (route) => {
            const query = new URL(route.request().url()).searchParams.get(
                "data",
            );
            if (!query) return route.abort();
            if (!results.has(query)) results.set(query, undefined);
            waiting++;
            const text = await answer(query).finally(() => waiting--);
            if (text !== null) results.set(query, text);
            try {
                await route.fulfill(
                    text === null
                        ? { status: 504, body: "No server answered" }
                        : {
                              status: 200,
                              contentType: "application/json",
                              headers: { "Access-Control-Allow-Origin": "*" },
                              body: text,
                          },
                );
            } catch {
                // The page went away meanwhile
            }
        },
    );

    const page = await context.newPage();
    page.on("pageerror", (error) => log("page error:", error.message));
    await page.goto(appUrl);
    await page.getByTitle("Settings", { exact: true }).waitFor();
    const finished = await preload(page);
    log(finished ? "preload finished" : "preload did not finish in time");
    await browser.close();
    server.close();

    // --- Writing the package ---

    const previousDir = options.previous && path.resolve(options.previous);
    const previous = new Set();
    if (previousDir && existsSync(path.join(previousDir, "index.json"))) {
        const index = JSON.parse(
            await readFile(path.join(previousDir, "index.json"), "utf8"),
        );
        for (const key of index.keys ?? []) previous.add(key);
    }

    await rm(out, { recursive: true, force: true });
    await mkdir(out, { recursive: true });
    const keys = new Set();
    let fresh = 0;
    let kept = 0;
    let missing = 0;
    for (const [query, text] of results) {
        const key = packageKey(query);
        if (text !== undefined) {
            await writeFile(path.join(out, `${key}.json`), text);
            keys.add(key);
            fresh++;
        } else if (previous.has(key)) {
            await writeFile(
                path.join(out, `${key}.json`),
                await readFile(path.join(previousDir, `${key}.json`)),
            );
            keys.add(key);
            kept++;
        } else {
            missing++;
        }
    }
    // A preload that stopped early asked fewer queries: keep the rest of the
    // previous package rather than lose it
    if (!finished) {
        for (const key of previous) {
            if (keys.has(key)) continue;
            await writeFile(
                path.join(out, `${key}.json`),
                await readFile(path.join(previousDir, `${key}.json`)),
            );
            keys.add(key);
            kept++;
        }
    }
    await writeFile(
        path.join(out, "index.json"),
        JSON.stringify(
            {
                createdAt: new Date().toISOString(),
                complete: finished && missing === 0,
                keys: [...keys].sort(),
            },
            null,
            1,
        ),
    );
    log(
        `package: ${keys.size} answers (${fresh} new, ${kept} from the previous package), ${missing} missing`,
    );
    return finished && missing === 0 ? 0 : 2;
};

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(error);
        process.exit(1);
    },
);
