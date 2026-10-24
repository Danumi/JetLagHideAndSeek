import { persistentAtom } from "@nanostores/persistent";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { Map } from "leaflet";
import { atom, computed, onSet } from "nanostores";

import type {
    AdditionalMapGeoLocations,
    CustomStation,
    OpenStreetMap,
    StationCircle,
    StationPlace,
} from "@/maps/api";
import { extractStationLabel } from "@/maps/geo-utils";
import type { HiderAnswer } from "@/maps/hider";
import {
    type AnswerStatus,
    type DeepPartial,
    type Question,
    type Questions,
    questionSchema,
    questionsSchema,
    type Units,
} from "@/maps/schema";

/** Vienna (OSM relation 109166, admin level 4), the default game area. */
export const VIENNA: OpenStreetMap = {
    type: "Feature",
    properties: {
        osm_type: "R",
        osm_id: 109166,
        osm_key: "place",
        osm_value: "city",
        type: "city",
        name: "Vienna",
        country: "Austria",
        countrycode: "AT",
    },
    geometry: {
        type: "Point",
        coordinates: [48.2083537, 16.3725042],
    },
};

/** Hiding zones in a Small game: U-Bahn stations only. */
export const SUBWAY_STATIONS = "[railway=station][subway=yes]";
export const SMALL_HIDING_RADIUS_METERS = 500;

export const mapGeoLocation = persistentAtom<OpenStreetMap>(
    "mapGeoLocation",
    VIENNA,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);

export const additionalMapGeoLocations = persistentAtom<
    AdditionalMapGeoLocations[]
>("additionalMapGeoLocations", [], {
    encode: JSON.stringify,
    decode: JSON.parse,
});

export const mapGeoJSON = atom<FeatureCollection<
    Polygon | MultiPolygon
> | null>(null);
export const polyGeoJSON = persistentAtom<FeatureCollection<
    Polygon | MultiPolygon
> | null>("polyGeoJSON", null, {
    encode: JSON.stringify,
    decode: JSON.parse,
});

/**
 * Questions waiting for an answer can be changed until they are sent: older
 * versions had a lock button that could leave them locked with no way to
 * unlock them. Sent ones open with "Change and send again".
 */
const unlockPending = (list: Questions) => {
    for (const question of list) {
        // Except those sent to the hider: they keep the version sent
        if (question.data.status === "pending") {
            question.data.drag = question.data.sentAt === undefined;
        }
    }
    return list;
};

export const questions = persistentAtom<Questions>("questions", [], {
    encode: JSON.stringify,
    decode: (x) => {
        const saved = JSON.parse(x);
        const parsed = questionsSchema.safeParse(saved);
        if (parsed.success) return unlockPending(parsed.data);
        // Keep every question that still loads instead of breaking the app
        return unlockPending(
            (Array.isArray(saved) ? saved : []).flatMap((question) => {
                const one = questionSchema.safeParse(question);
                return one.success ? [one.data] : [];
            }),
        );
    },
});
/** New questions wait for the hider's answer before they change the map. */
export const addQuestion = (question: DeepPartial<Question>) =>
    questionModified(
        questions.get().push(
            questionSchema.parse({
                ...question,
                data: {
                    status: "pending",
                    askedAt: Date.now(),
                    ...question.data,
                },
            }),
        ),
    );
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const questionModified = (..._: any[]) => {
    questions.set([...questions.get()]);
};

export const leafletMapContext = atom<Map | null>(null);

export type HiderLocation = { latitude: number; longitude: number };
/** The hider's location while this phone is in hider mode, else false. */
export const hiderMode = persistentAtom<false | HiderLocation>(
    "isHiderMode",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
/**
 * When the hider set their location by hand ("Pick on map", the H marker),
 * else null: then GPS. Until the hider looks up GPS again ("Update"), a new
 * role or a move; not kept when the app starts again.
 */
export const hiderPlacedAt = atom<number | null>(null);
/**
 * Whether someone picked this phone's role ("I'm seeking" or "I'm hiding"),
 * at "New Game" or in the settings. Until then, a question link turns the
 * phone into the hider's.
 */
export const roleChosen = persistentAtom<boolean>("roleChosen", false, {
    encode: JSON.stringify,
    decode: JSON.parse,
});
/** Whether the hider mode screen is shown on top of the map. */
export const hiderScreenOpen = atom<boolean>(false);
/** Whether the settings drawer is open. */
export const settingsOpen = atom<boolean>(false);
/**
 * The help on top of everything: the quick guide, or the rules, opened at
 * one of their entries (rules.ts) by the "?" on a question.
 */
export const helpOpen = atom<{
    tab: "guide" | "rules";
    ruleId?: string;
} | null>(null);
/** The help is German unless this phone switched it to English, whatever the app's language. */
export const helpLanguage = persistentAtom<"de" | "en">("helpLanguage", "de", {
    encode: (value) => value,
    decode: (value) => (value === "en" ? "en" : "de"),
});
/** Whether this phone has seen the quick guide; until then it opens by itself. */
export const guideSeen = persistentAtom<boolean>("guideSeen", false, {
    encode: JSON.stringify,
    decode: JSON.parse,
});
/** On: the map keeps your own position (the blue dot) in the middle. */
export const followMyPosition = atom<boolean>(true);
/** A point that "Pick on map" moves: a question's (a thermometer's start or end) or, with questionKey -1, the hider's H marker. */
export type PickTarget = { questionKey: number; point?: "start" | "end" };
/** "Pick on map" is on: the next tap on the map moves this point. */
export const pickingLocation = atom<PickTarget | null>(null);
/**
 * A photo question the seekers asked. The app can't check photos: it is only
 * an entry in the question log, with the time the hider has to answer.
 */
export type PhotoQuestion = {
    key: number;
    /** Its card in PHOTO_DECK. */
    photo: string;
    askedAt: number;
    /** When the seekers first sent it to the hider. */
    sentAt?: number;
    /** "answered": the photo came. */
    status: AnswerStatus;
};
export const photoQuestions = persistentAtom<PhotoQuestion[]>(
    "photoQuestions",
    [],
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
/** A new photo question waits for the hider's photo. */
export const addPhotoQuestion = (photo: string) => {
    const question: PhotoQuestion = {
        key: Math.random(),
        photo,
        askedAt: Date.now(),
        status: "pending",
    };
    photoQuestions.set([...photoQuestions.get(), question]);
    return question;
};
export const updatePhotoQuestion = (
    key: number,
    change: Partial<PhotoQuestion>,
) =>
    photoQuestions.set(
        photoQuestions
            .get()
            .map((photo) =>
                photo.key === key ? { ...photo, ...change } : photo,
            ),
    );
/** Questions asked in the chat that the hider adds by hand: only their kind. */
export type ChatQuestionKind =
    | "matching"
    | "measuring"
    | "radar"
    | "thermometer";
/** A question in the hider's log: from a question link, or added by hand. */
export type HiderInboxEntry = {
    key: number;
    /** From a question link: the app works out the answer. */
    question?: Question;
    /** A photo question: its card in PHOTO_DECK. */
    photo?: string;
    /** A question asked in the chat, added by hand. */
    kind?: ChatQuestionKind;
    /** Added by the hider, not from a link. */
    byHand?: boolean;
    /** The question's number on the seekers' phone (older links). */
    number?: number;
    /** When the seekers asked: the time to answer starts here. */
    askedAt: number;
    receivedAt: number;
    /** The answer the app worked out last, shown in the phone's language. */
    workedOut?: Pick<HiderAnswer, "value" | "location">;
    /** The same as a text, like "Outside", from phones before Etappe 15. */
    answer?: string;
    /** When the hider answered; the question is open until then. */
    answeredAt?: number;
    /**
     * The answer the hider gave: an answer option's value, "no-answer",
     * "photo" (sent), or "answered" (told in the chat).
     */
    sent?: Pick<HiderAnswer, "value" | "location">;
};
/**
 * Entries saved before the hider could mark questions as answered (Etappe
 * 17) count as answered, or they would all wait with a late clock.
 */
const migrateInbox = (saved: unknown): HiderInboxEntry[] =>
    (Array.isArray(saved) ? saved : []).map((entry) =>
        "key" in entry
            ? entry
            : {
                  ...entry,
                  key: entry.question?.key ?? Math.random(),
                  askedAt:
                      entry.question?.data?.askedAt ?? entry.receivedAt ?? 0,
                  answeredAt: entry.receivedAt ?? 0,
              },
    );
/** Questions the hider got on this phone, newest last. */
export const hiderInbox = persistentAtom<HiderInboxEntry[]>("hiderInbox", [], {
    encode: JSON.stringify,
    decode: (x) => migrateInbox(JSON.parse(x)),
});
export const triggerLocalRefresh = atom<number>(0);
export const displayHidingZones = persistentAtom<boolean>(
    "displayHidingZones",
    true,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const displayHidingZonesOptions = persistentAtom<string[]>(
    "displayHidingZonesOptions",
    [SUBWAY_STATIONS],
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const displayHidingZonesStyle = persistentAtom<
    "zones" | "stations" | "no-overlap" | "no-display"
>("displayHidingZonesStyle", "zones");
/** The hiding zone tapped on the map or in the zone list (its station's id), or "". */
export const selectedZoneId = atom<string>("");
export const zoneSheetOpen = atom<boolean>(false);
export const questionFinishedMapData = atom<any>(null);

export const trainStations = atom<StationCircle[]>([]);
/**
 * Every station in the game area, including ones already ruled out. The
 * seekers' nearest station must be found among these, not just the
 * remaining hiding zones.
 */
export const allTrainStations = atom<StationPlace[]>([]);
onSet(trainStations, ({ newValue }) => {
    newValue.sort((a, b) => {
        const aName = (extractStationLabel(a.properties) || "") as string;
        const bName = (extractStationLabel(b.properties) || "") as string;
        return aName.localeCompare(bName);
    });
});

export const useCustomStations = persistentAtom<boolean>(
    "useCustomStations",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const customStations = persistentAtom<CustomStation[]>(
    "customStations",
    [],
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const includeDefaultStations = persistentAtom<boolean>(
    "includeDefaultStations",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const hidingRadius = persistentAtom<number>(
    "hidingRadius",
    SMALL_HIDING_RADIUS_METERS,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const hidingRadiusUnits = persistentAtom<Units>(
    "hidingRadiusUnits",
    "meters",
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);

// Players only see metric units: convert settings saved in miles by older versions.
if (hidingRadiusUnits.get() === "miles") {
    hidingRadius.set(
        Math.round(hidingRadius.get() * 1609.344), // meters per mile
    );
    hidingRadiusUnits.set("meters");
}
// An emptied radius field used to save an invalid radius
const savedHidingRadius = hidingRadius.get();
if (!(Number.isFinite(savedHidingRadius) && savedHidingRadius > 0)) {
    hidingRadius.set(SMALL_HIDING_RADIUS_METERS);
    hidingRadiusUnits.set("meters");
}
export const disabledStations = persistentAtom<string[]>(
    "disabledStations",
    [],
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
/**
 * Zones ruled out by "Only this zone" or "Keep only these": "Show all zones"
 * brings back just these, not the ones ruled out one by one.
 */
export const keptZonesRuledOut = persistentAtom<string[]>(
    "keptZonesRuledOut",
    [],
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
/** The hiding zone the hider chose for the endgame (its station's id), or "". */
export const hiderZoneId = persistentAtom<string>("hiderZoneId", "");
/** The hider's map shows only their own zone, not the others (per phone). */
export const hideOtherZones = persistentAtom<boolean>("hideOtherZones", false, {
    encode: JSON.stringify,
    decode: JSON.parse,
});

/* Presets for custom questions (savable / sharable / editable) */
export type CustomPreset = {
    id: string;
    name: string;
    type: string;
    data: any;
    createdAt: string;
};

export const customPresets = persistentAtom<CustomPreset[]>(
    "customPresets",
    [],
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
onSet(customPresets, ({ newValue }) => {
    newValue.sort((a, b) => a.name.localeCompare(b.name));
});

export const saveCustomPreset = (
    preset: Omit<CustomPreset, "id" | "createdAt">,
) => {
    const id =
        typeof crypto !== "undefined" &&
        typeof (crypto as any).randomUUID === "function"
            ? (crypto as any).randomUUID()
            : String(Date.now());
    const p: CustomPreset = {
        ...preset,
        id,
        createdAt: new Date().toISOString(),
    };
    customPresets.set([...customPresets.get(), p]);
    return p;
};

export const updateCustomPreset = (
    id: string,
    updates: Partial<CustomPreset>,
) => {
    customPresets.set(
        customPresets
            .get()
            .map((p) => (p.id === id ? { ...p, ...updates } : p)),
    );
};

export const deleteCustomPreset = (id: string) => {
    customPresets.set(customPresets.get().filter((p) => p.id !== id));
};

export const hidingZone = computed(
    [
        questions,
        polyGeoJSON,
        mapGeoLocation,
        additionalMapGeoLocations,
        disabledStations,
        hidingRadius,
        hidingRadiusUnits,
        displayHidingZonesOptions,
        useCustomStations,
        customStations,
        includeDefaultStations,
        customPresets,
    ],
    (
        q,
        geo,
        loc,
        altLoc,
        disabledStations,
        radius,
        hidingRadiusUnits,
        zoneOptions,
        useCustom,
        $customStations,
        includeDefault,
        presets,
    ) => {
        if (geo !== null) {
            return {
                ...geo,
                questions: q,
                disabledStations: disabledStations,
                hidingRadius: radius,
                hidingRadiusUnits,
                zoneOptions: zoneOptions,
                useCustomStations: useCustom,
                customStations: $customStations,
                includeDefaultStations: includeDefault,
                presets: structuredClone(presets),
            };
        } else {
            const $loc = structuredClone(loc);
            $loc.properties.isHidingZone = true;
            $loc.properties.questions = q;
            return {
                ...$loc,
                disabledStations: disabledStations,
                hidingRadius: radius,
                hidingRadiusUnits,
                alternateLocations: structuredClone(altLoc),
                zoneOptions: zoneOptions,
                useCustomStations: useCustom,
                customStations: $customStations,
                includeDefaultStations: includeDefault,
                presets: structuredClone(presets),
            };
        }
    },
);

export const drawingQuestionKey = atom<number>(-1);

export const isLoading = atom<boolean>(false);
/** Resolves once the map isn't computing, so its own questions go first. */
export const mapIdle = () =>
    new Promise<void>((resolve) => {
        if (!isLoading.get()) return resolve();
        const unbind = isLoading.listen((loading) => {
            if (loading) return;
            unbind();
            resolve();
        });
    });

export const BASE_TILE_LAYERS = [
    "voyager",
    "light",
    "dark",
    "osmcarto",
] as const;
export const baseTileLayer = persistentAtom<(typeof BASE_TILE_LAYERS)[number]>(
    "baseTileLayer",
    "voyager",
);
// Older versions also offered Thunderforest maps, which needed an API key
if (!BASE_TILE_LAYERS.includes(baseTileLayer.get())) {
    baseTileLayer.set("voyager");
}
/**
 * This phone's last GPS position (accuracy in meters, time it was taken),
 * shown as a blue dot.
 */
export const myPosition = atom<{
    lat: number;
    lng: number;
    accuracy: number;
    at: number;
} | null>(null);
/** Off: the drawing toolbar only shows while a custom question is drawn. */
export const showDrawingTools = persistentAtom<boolean>(
    "showDrawingTools",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);

/** Off: question cards only offer the Small deck. On: every question type. */
export const showAllQuestionTypes = persistentAtom<boolean>(
    "showAllQuestionTypes",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
/** A thermometer the seekers have started but not finished yet. */
export const thermometerRun = persistentAtom<{
    latA: number;
    lngA: number;
    /** How precise the GPS position of the start was, in meters. */
    accuracyA?: number;
    kilometers: number;
    /** When the seekers told the hider they are starting. */
    toldAt?: number;
} | null>("thermometerRun", null, {
    encode: JSON.stringify,
    decode: JSON.parse,
});

/**
 * The Overpass server for map data, with the key in it (e.g. overpass.ch).
 * There are no public servers any more: without it, no map data loads. Set by
 * hand or with a setup link (`overpassAccess.ts`).
 */
export const overpassCustomHost = persistentAtom<string>(
    "overpassCustomHost",
    "",
);
