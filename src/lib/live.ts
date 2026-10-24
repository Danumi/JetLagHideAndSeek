import { persistentAtom } from "@nanostores/persistent";
import * as turf from "@turf/turf";
import { atom } from "nanostores";

import { hiderInbox, hiderMode, myPosition } from "@/lib/context";
import { shareSeekerMap, startSeekerMap } from "@/lib/liveMap";
import { fromBase64Url, toBase64Url } from "@/lib/overpassAccess";
import {
    endRound,
    type GameClock,
    gameClock,
    gameClockState,
    type Interval,
    pauseForLateAnswers,
} from "@/maps/gameClock";
import {
    lateIntervals,
    type LateRange,
    lateRanges,
    lateUntil,
} from "@/maps/hiderLog";

/*
 * The phones of a game, connected through a small database (Firebase
 * Realtime Database, free plan, on Daniel's Google account): the game timer
 * runs the same on all of them, and the hider sees where the seekers are
 * while the app is open on their phones (a website can't send its location
 * with the screen locked). The database's address is never in the repo: one
 * phone has it in the settings and hands it to the others with the game's
 * link or QR code, together with the game's secret. Everything is encrypted
 * with a key from the secret, under a name made from the secret: the
 * database only stores gibberish. Its rules (set in Firebase) allow reading
 * and writing a game only by that name:
 *
 * {"rules":{"g":{"$game":{".read":"$game.length === 32","$kind":{"$item":{
 *  ".write":"$game.length === 32",
 *  ".validate":"newData.isString() && newData.val().length < 10000"}}}}}}
 *
 * In the database: g/<name>/clock/state (the timer, any phone),
 * g/<name>/clock/late (when answers were late, the hider's phone),
 * g/<name>/pos/<phone> (where a seeker's phone was),
 * g/<name>/phones/<phone> (each phone's role, so they see who's connected)
 * and g/<name>/seek/<item> (the seekers' map, liveMap.ts).
 */

/** The database's rules refuse longer texts. */
const MAX_TEXT_LENGTH = 10_000;

const json = { encode: JSON.stringify, decode: JSON.parse };

/** The database's address, e.g. https://….europe-west1.firebasedatabase.app. */
export const liveAddress = persistentAtom<string>("liveAddress", "");

/** A game: the database it's in and its secret, from the link. */
export type LiveGame = { address: string; secret: string };

/** The game this phone is connected to, or null. */
export const liveGame = persistentAtom<LiveGame | null>("liveGame", null, json);

/** This phone among the game's phones. */
const phoneId = persistentAtom<string>("livePhone", "");

/** When this phone's game timer last changed, here or on another phone. */
const clockChangedAt = persistentAtom<number>("liveClockAt", 0, json);

/** When answers were late, as the hider's phone knows it. */
export const hiderLate = persistentAtom<LateRange[]>("liveHiderLate", [], json);

/** Seekers: the screen stays on, so the hider keeps seeing where they are. */
export const keepScreenOn = persistentAtom<boolean>(
    "liveKeepScreenOn",
    false,
    json,
);

export type LiveStatus = "off" | "connecting" | "connected" | "failed";
export const liveStatus = atom<LiveStatus>("off");

/** Where a seeker's phone was, and when it said so. */
export type SeekerPosition = {
    lat: number;
    lng: number;
    accuracy: number;
    /** When GPS measured it. */
    at: number;
    /** When the phone sent it: the app was open then. */
    sentAt: number;
};

/** Where the seekers' phones last were, by phone; not this phone's. */
export const seekerPositions = atom<Record<string, SeekerPosition>>({});

/** Positions older than this aren't shown: from an earlier round. */
export const SEEKER_POSITION_MAX_AGE_MS = 3 * 60 * 60_000;

/** A phone of the game, as it tells the others while the app is open. */
export type GamePhone = {
    role: "hider" | "seeker";
    /** Whether the phone knows where it is (seekers: GPS allowed). */
    located: boolean;
    seenAt: number;
};

/** The game's other phones, by phone: open in the last 3 hours. */
export const gamePhones = atom<Record<string, GamePhone>>({});

/** The game's short code, the same on all its phones: to compare them. */
export const liveGameCode = atom<string>("");

/** A phone tells the others it's still there this often while open. */
const PHONE_EVERY_MS = 60_000;

/** A seeker's phone sends its position this often while the app is open… */
export const POSITION_EVERY_MS = 30_000;
/** …and sooner when it moved this far, but not more often than this. */
export const POSITION_MOVED_METERS = 20;
export const POSITION_MIN_GAP_MS = 5_000;

/** Without https only on this computer: a stand-in database for tests. */
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/** The database's address without anything after it, or "" if it isn't one. */
export const databaseAddress = (text: string) => {
    try {
        const url = new URL(text.trim());
        const local =
            url.protocol === "http:" && LOCAL_HOSTS.includes(url.hostname);
        if (url.protocol !== "https:" && !local) return "";
        return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
    } catch {
        return "";
    }
};

const bytesToBase64Url = (bytes: Uint8Array) =>
    toBase64Url(String.fromCharCode(...bytes));

const base64UrlToBytes = (code: string) =>
    Uint8Array.from(fromBase64Url(code), (char) => char.charCodeAt(0));

const randomCode = (bytes: number) =>
    bytesToBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));

const thisPhone = () => {
    if (!phoneId.get()) phoneId.set(randomCode(9));
    return phoneId.get();
};

/** In the address: https://…/JetLagHideAndSeek/#live=… */
const LINK_PARAM = "live";

/** The link (and QR code) that connects another phone to the game. */
export const liveLink = (game: LiveGame, appUrl: string) => {
    const url = new URL(appUrl);
    url.search = "";
    url.hash = `${LINK_PARAM}=${toBase64Url(
        JSON.stringify({ a: game.address, s: game.secret }),
    )}`;
    return url.toString();
};

/** The game in a link (or in anything pasted that contains one), or null. */
export const readLiveLink = (text: string): LiveGame | null => {
    const code = text.match(
        new RegExp(`[#&?]${LINK_PARAM}=([A-Za-z0-9_-]+)`),
    )?.[1];
    if (!code) return null;
    try {
        const { a, s } = JSON.parse(fromBase64Url(code));
        const address = databaseAddress(String(a ?? ""));
        return address &&
            typeof s === "string" &&
            /^[A-Za-z0-9_-]{16,}$/.test(s)
            ? { address, secret: s }
            : null;
    } catch {
        return null;
    }
};

/**
 * Starts a game on this phone, in the database of the settings: its timer
 * is the one the other phones take when they join. Null without a database.
 */
export const createLiveGame = () => {
    const address = databaseAddress(liveAddress.get());
    if (!address) return null;
    const game = { address, secret: randomCode(16) };
    clockChangedAt.set(Date.now());
    startSeekerMap(true);
    liveGame.set(game);
    return game;
};

/**
 * Joins the game of a link: from now on this phone's timer is the game's.
 * Whether the phone wasn't in this game yet.
 */
export const joinLiveGame = (game: LiveGame) => {
    const current = liveGame.get();
    if (current?.address === game.address && current.secret === game.secret) {
        return false;
    }
    liveAddress.set(game.address);
    clockChangedAt.set(0);
    startSeekerMap(false);
    hiderLate.set([]);
    liveGame.set(game);
    return true;
};

/** This phone leaves the game; its timer runs on by itself. */
export const leaveLiveGame = () => liveGame.set(null);

/**
 * Joins the game of a link the app was opened with, and takes the link out
 * of the address bar: "joined", "already" (in this game) or null.
 */
export const takeLiveFromAddress = () => {
    if (typeof window === "undefined") return null;
    const game = readLiveLink(window.location.hash);
    if (!game) return null;
    window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
    );
    return joinLiveGame(game) ? "joined" : "already";
};

const encoder = new TextEncoder();

const sha256 = async (text: string) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text)));

export type GameKeys = { name: string; key: CryptoKey };

/** The game's name in the database and the key for its data, from its secret. */
export const gameKeys = async (secret: string): Promise<GameKeys> => {
    const name = [...(await sha256(`name:${secret}`))]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 32);
    const key = await crypto.subtle.importKey(
        "raw",
        await sha256(`key:${secret}`),
        "AES-GCM",
        false,
        ["encrypt", "decrypt"],
    );
    return { name, key };
};

/** Encrypted, as text for the database. */
export const seal = async (key: CryptoKey, value: unknown) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            encoder.encode(JSON.stringify(value)),
        ),
    );
    const all = new Uint8Array(iv.length + data.length);
    all.set(iv);
    all.set(data, iv.length);
    return bytesToBase64Url(all);
};

/** What `seal` encrypted, or undefined for anything else. */
export const unseal = async <T>(
    key: CryptoKey,
    text: unknown,
): Promise<T | undefined> => {
    if (typeof text !== "string") return undefined;
    try {
        const all = base64UrlToBytes(text);
        const data = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: all.slice(0, 12) },
            key,
            all.slice(12),
        );
        return JSON.parse(new TextDecoder().decode(data));
    } catch {
        return undefined;
    }
};

/** The game as the database streams it: encrypted texts by kind and item. */
export type Snapshot = Record<string, Record<string, string>>;

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const asItems = (value: unknown) =>
    Object.fromEntries(
        Object.entries(isObject(value) ? value : {}).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
    );

/**
 * A change from the database's stream (a "put" replaces what's at `path`,
 * a "patch" the children it names), applied to the game.
 */
export const applyChange = (
    snapshot: Snapshot,
    event: "put" | "patch",
    path: string,
    data: unknown,
): Snapshot => {
    const parts = path.split("/").filter(Boolean);
    if (event === "patch") {
        return Object.entries(isObject(data) ? data : {}).reduce(
            (next, [key, value]) =>
                applyChange(next, "put", [...parts, key].join("/"), value),
            snapshot,
        );
    }
    if (parts.length === 0) {
        return Object.fromEntries(
            Object.entries(isObject(data) ? data : {}).map(([kind, items]) => [
                kind,
                asItems(items),
            ]),
        );
    }
    const [kind, ...rest] = parts;
    if (rest.length === 0) {
        const others = { ...snapshot };
        delete others[kind];
        return isObject(data) ? { ...others, [kind]: asItems(data) } : others;
    }
    if (rest.length > 1) {
        // Deeper than the app writes: not one of its items
        return snapshot;
    }
    const items = { ...snapshot[kind] };
    if (typeof data === "string") items[rest[0]] = data;
    else delete items[rest[0]];
    return { ...snapshot, [kind]: items };
};

/** The game timer as the phones share it. */
export type SharedClock = {
    clock: GameClock | null;
    /** When it last changed, on the phone that changed it. */
    at: number;
    by: string;
};

/** When answers were late, from the hider's phone. */
export type SharedLate = { ranges: LateRange[]; by: string };

/**
 * What to do with the game's timer: "take" the other phones' newer one,
 * "send" this phone's newer one, or "keep" when they're the same.
 */
export const clockStep = (remoteAt: number | undefined, localAt: number) =>
    remoteAt === undefined || remoteAt < localAt
        ? "send"
        : remoteAt > localAt
          ? "take"
          : "keep";

/** Whether a seeker's phone sends its position again. */
export const positionDue = (
    last: SeekerPosition | null,
    next: { lat: number; lng: number },
    now: number,
) =>
    !last ||
    now - last.sentAt >= POSITION_EVERY_MS ||
    (now - last.sentAt >= POSITION_MIN_GAP_MS &&
        turf.distance([last.lng, last.lat], [next.lng, next.lat], {
            units: "meters",
        }) >= POSITION_MOVED_METERS);

const isPhone = (value: unknown): value is GamePhone =>
    isObject(value) &&
    (value.role === "hider" || value.role === "seeker") &&
    typeof value.located === "boolean" &&
    Number.isFinite(value.seenAt);

const isPosition = (value: unknown): value is SeekerPosition =>
    isObject(value) &&
    ["lat", "lng", "accuracy", "at", "sentAt"].every((key) =>
        Number.isFinite(value[key]),
    );

/**
 * When late answers stopped the hiding time: the hider's phone knows it
 * (with "pause for late answers" on), connected seekers get it from there.
 */
export const lateAnswersFor = (
    {
        hider,
        connected,
        pause,
        inbox,
        shared,
    }: {
        hider: boolean;
        connected: boolean;
        pause: boolean;
        inbox: Parameters<typeof lateIntervals>[0];
        shared: LateRange[];
    },
    now = Date.now(),
): Interval[] =>
    hider || !connected
        ? pause
            ? lateIntervals(inbox, now)
            : []
        : lateUntil(shared, now);

export const lateAnswerIntervals = (now = Date.now()) =>
    lateAnswersFor(
        {
            hider: hiderMode.get() !== false,
            connected: liveGame.get() !== null,
            pause: pauseForLateAnswers.get(),
            inbox: hiderInbox.get(),
            shared: hiderLate.get(),
        },
        now,
    );

/**
 * Whether "New Game" leaves the game timer running: on a connected phone
 * during the hiding period, the round has just started on the other phones
 * and this phone joins it (e.g. a seeker choosing their role).
 */
export const newGameKeepsClock = (now = Date.now()) => {
    const clock = gameClock.get();
    return (
        liveGame.get() !== null &&
        clock !== null &&
        gameClockState(clock, now, lateAnswerIntervals(now)).phase === "hiding"
    );
};

/** The ranges the hider shares: those that are or can still become late. */
const ownLateRanges = () =>
    pauseForLateAnswers.get()
        ? lateRanges(hiderInbox.get()).filter(
              ({ from, to }) => to === undefined || to > from,
          )
        : [];

/** Reconnecting after the app was away longer than this: the stream may be dead. */
const STALE_AFTER_HIDDEN_MS = 10_000;

/** Keeps this phone in step with the game's other phones, until stopped. */
const connect = (game: LiveGame) => {
    let stopped = false;
    let keys: GameKeys | null = null;
    let source: EventSource | null = null;
    let snapshot: Snapshot = {};
    let hiddenAt: number | null = null;
    let lastSent: SeekerPosition | null = null;
    let lastTold: { said: string; at: number } | null = null;
    let wakeLock: WakeLockSentinel | null = null;
    // While the timer of another phone is taken: not a change to send
    let taking = false;

    // One thing after the other, so a change doesn't overtake another
    let queue = Promise.resolve();
    const run = (task: () => Promise<void> | void) => {
        queue = queue
            .then(() => (stopped ? undefined : task()))
            .catch((error) => console.warn("Live connection:", error));
    };

    const url = (item: string) =>
        `${game.address}/g/${keys!.name}${item ? `/${item}` : ""}.json`;

    const writeText = async (item: string, text: string | null) => {
        const response = await fetch(
            url(item),
            text === null
                ? { method: "DELETE" }
                : { method: "PUT", body: JSON.stringify(text) },
        );
        if (!response.ok) {
            throw new Error(
                `${item}: ${response.status} ${response.statusText}`,
            );
        }
    };

    const write = async (item: string, value: unknown) => {
        if (!keys) return;
        await writeText(
            item,
            value === null ? null : await seal(keys.key, value),
        );
    };

    /** Several items of a kind at once (null removes one), else none. */
    const writeItems = async (
        kind: string,
        changes: Record<string, unknown>,
    ) => {
        if (!keys) throw new Error(`${kind}: not connected yet`);
        const texts: Record<string, string | null> = {};
        for (const [item, value] of Object.entries(changes)) {
            const text = value === null ? null : await seal(keys.key, value);
            if (text !== null && text.length >= MAX_TEXT_LENGTH) {
                console.warn(`Live connection: ${kind}/${item} is too long`);
                continue;
            }
            texts[item] = text;
        }
        if (Object.keys(texts).length === 0) return;
        const response = await fetch(url(kind), {
            method: "PATCH",
            body: JSON.stringify(texts),
        });
        if (response.ok) return;
        if (response.status !== 401 && response.status !== 403) {
            throw new Error(
                `${kind}: ${response.status} ${response.statusText}`,
            );
        }
        // Rules that let only one item be written at a time
        for (const [item, text] of Object.entries(texts)) {
            await writeText(`${kind}/${item}`, text);
        }
    };

    // Decrypted items by their encrypted text: most stay the same
    const opened: Record<string, Map<string, unknown>> = {};
    const readItems = async (kind: string) => {
        const before = opened[kind] ?? new Map<string, unknown>();
        const now = new Map<string, unknown>();
        const items: Record<string, unknown> = {};
        for (const [item, text] of Object.entries(snapshot[kind] ?? {})) {
            const value = before.has(text)
                ? before.get(text)
                : await unseal<unknown>(keys!.key, text);
            now.set(text, value);
            items[item] = value;
        }
        opened[kind] = now;
        return items;
    };

    const seekerMap = shareSeekerMap({
        me: thisPhone(),
        read: () => readItems("seek"),
        write: (changes) => writeItems("seek", changes),
        run: (task) => run(task),
    });

    const isSeeker = () => hiderMode.get() === false;

    const sendClock = () =>
        write("clock/state", {
            clock: gameClock.get(),
            at: clockChangedAt.get(),
            by: thisPhone(),
        } satisfies SharedClock);

    const takeClock = (shared: SharedClock) => {
        taking = true;
        try {
            // "New Game" on another phone: this phone keeps the round too
            if (shared.clock === null && gameClock.get() !== null) {
                endRound(Date.now(), lateAnswerIntervals());
            } else {
                gameClock.set(shared.clock);
            }
            clockChangedAt.set(shared.at);
        } finally {
            taking = false;
        }
    };

    const syncClock = async () => {
        const remote = await unseal<SharedClock>(
            keys!.key,
            snapshot.clock?.state,
        );
        const step = clockStep(remote?.at, clockChangedAt.get());
        if (step === "take") takeClock(remote!);
        if (step === "send") await sendClock();
    };

    const syncLate = async () => {
        const remote = await unseal<SharedLate>(
            keys!.key,
            snapshot.clock?.late,
        );
        if (isSeeker()) {
            const ranges = remote?.ranges ?? [];
            if (JSON.stringify(ranges) !== JSON.stringify(hiderLate.get())) {
                hiderLate.set(ranges);
            }
            return;
        }
        const own = ownLateRanges();
        if (!remote || JSON.stringify(remote.ranges) !== JSON.stringify(own)) {
            await write("clock/late", {
                ranges: own,
                by: thisPhone(),
            } satisfies SharedLate);
        }
    };

    const readPositions = async () => {
        const positions: Record<string, SeekerPosition> = {};
        for (const [phone, text] of Object.entries(snapshot.pos ?? {})) {
            if (phone === thisPhone()) continue;
            const position = await unseal<unknown>(keys!.key, text);
            if (isPosition(position)) positions[phone] = position;
        }
        seekerPositions.set(positions);
    };

    const sendPosition = async (force = false) => {
        const position = myPosition.get();
        if (
            !keys ||
            !position ||
            !isSeeker() ||
            document.visibilityState !== "visible"
        ) {
            return;
        }
        const now = Date.now();
        if (!force && !positionDue(lastSent, position, now)) return;
        const shared: SeekerPosition = {
            lat: position.lat,
            lng: position.lng,
            accuracy: position.accuracy,
            at: position.at,
            sentAt: now,
        };
        lastSent = shared;
        await write(`pos/${thisPhone()}`, shared);
    };

    /** The hider doesn't show up as a seeker, also after a change of role. */
    const removePosition = async () => {
        if (!keys || !snapshot.pos?.[thisPhone()]) return;
        lastSent = null;
        await write(`pos/${thisPhone()}`, null);
    };

    const readPhones = async () => {
        const phones: Record<string, GamePhone> = {};
        const now = Date.now();
        for (const [phone, text] of Object.entries(snapshot.phones ?? {})) {
            if (phone === thisPhone()) continue;
            const value = await unseal<unknown>(keys!.key, text);
            if (
                isPhone(value) &&
                now - value.seenAt < SEEKER_POSITION_MAX_AGE_MS
            ) {
                phones[phone] = value;
            }
        }
        gamePhones.set(phones);
    };

    /** Tells the other phones this one is there: on a change, else every minute. */
    const tellPhones = async (force = false) => {
        if (!keys || document.visibilityState !== "visible") return;
        const me: Omit<GamePhone, "seenAt"> = isSeeker()
            ? { role: "seeker", located: myPosition.get() !== null }
            : { role: "hider", located: true };
        const said = JSON.stringify(me);
        const now = Date.now();
        if (
            !force &&
            lastTold?.said === said &&
            now - lastTold.at < PHONE_EVERY_MS
        ) {
            return;
        }
        lastTold = { said, at: now };
        await write(`phones/${thisPhone()}`, {
            ...me,
            seenAt: now,
        } satisfies GamePhone);
    };

    const updateWakeLock = async () => {
        const wanted =
            keepScreenOn.get() &&
            isSeeker() &&
            document.visibilityState === "visible";
        if (wanted && !wakeLock && "wakeLock" in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request("screen");
                wakeLock.addEventListener("release", () => {
                    wakeLock = null;
                });
            } catch {
                wakeLock = null;
            }
        } else if (!wanted && wakeLock) {
            await wakeLock.release().catch(() => undefined);
            wakeLock = null;
        }
    };

    const open = () => {
        source?.close();
        if (stopped || !keys) return;
        liveStatus.set("connecting");
        const stream = new EventSource(url(""));
        source = stream;
        const onChange =
            (event: "put" | "patch") => (message: MessageEvent) => {
                try {
                    const { path, data } = JSON.parse(message.data);
                    snapshot = applyChange(snapshot, event, path, data);
                } catch {
                    return;
                }
                liveStatus.set("connected");
                run(async () => {
                    await syncClock();
                    await syncLate();
                    await readPositions();
                    await readPhones();
                    await seekerMap.sync();
                    if (isSeeker()) await sendPosition();
                    else await removePosition();
                    await tellPhones();
                });
            };
        stream.addEventListener("put", onChange("put"));
        stream.addEventListener("patch", onChange("patch"));
        // The database's rules refused: wrong address or rules
        const refused = () => {
            stream.close();
            liveStatus.set("failed");
        };
        stream.addEventListener("cancel", refused);
        stream.addEventListener("auth_revoked", refused);
        stream.onerror = () => {
            // The browser tries again by itself unless it gave up
            liveStatus.set(
                stream.readyState === EventSource.CLOSED
                    ? "failed"
                    : "connecting",
            );
        };
    };

    const onVisibility = () => {
        if (document.visibilityState !== "visible") {
            hiddenAt = Date.now();
            return;
        }
        const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
        hiddenAt = null;
        if (
            !source ||
            source.readyState === EventSource.CLOSED ||
            away > STALE_AFTER_HIDDEN_MS
        ) {
            open();
        }
        run(() => sendPosition(true));
        run(() => tellPhones(true));
        run(updateWakeLock);
    };
    const onOnline = () => open();

    const unlisten = [
        gameClock.listen(() => {
            if (taking) return;
            // Later than the change it follows, also if this phone's clock is behind
            clockChangedAt.set(Math.max(Date.now(), clockChangedAt.get() + 1));
            run(sendClock);
        }),
        hiderInbox.listen(() => run(syncLate)),
        pauseForLateAnswers.listen(() => run(syncLate)),
        hiderMode.listen(() => {
            run(syncLate);
            run(() => (isSeeker() ? sendPosition(true) : removePosition()));
            run(() => tellPhones());
            run(updateWakeLock);
        }),
        myPosition.listen(() => {
            run(() => sendPosition());
            run(() => tellPhones());
        }),
        keepScreenOn.listen(() => run(updateWakeLock)),
    ];
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    // Also when GPS has nothing new: the hider sees the app is still open
    const timer = setInterval(() => {
        run(() => sendPosition());
        run(() => tellPhones());
    }, 10_000);

    gameKeys(game.secret).then((gameKeys) => {
        if (stopped) return;
        keys = gameKeys;
        liveGameCode.set(gameKeys.name.slice(0, 4).toUpperCase());
        open();
        run(updateWakeLock);
    });

    return () => {
        stopped = true;
        seekerMap.stop();
        source?.close();
        clearInterval(timer);
        unlisten.forEach((stop) => stop());
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("online", onOnline);
        wakeLock?.release().catch(() => undefined);
        // Off the hider's map and the list: not one of the game's phones any more
        for (const kind of ["pos", "phones"]) {
            if (keys && snapshot[kind]?.[thisPhone()]) {
                fetch(url(`${kind}/${thisPhone()}`), {
                    method: "DELETE",
                }).catch(() => undefined);
            }
        }
        seekerPositions.set({});
        gamePhones.set({});
        liveGameCode.set("");
        liveStatus.set("off");
    };
};

/**
 * Connects this phone to its game, and again whenever it joins another;
 * once, when the app starts. Returns the function that stops it.
 */
export const startLiveSync = () => {
    let stop: (() => void) | null = null;
    const unsubscribe = liveGame.subscribe((game) => {
        stop?.();
        stop = game ? connect(game) : null;
    });
    return () => {
        unsubscribe();
        stop?.();
        stop = null;
    };
};
