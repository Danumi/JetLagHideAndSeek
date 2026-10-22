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
import {
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

export const questions = persistentAtom<Questions>("questions", [], {
    encode: JSON.stringify,
    decode: (x) => {
        const saved = JSON.parse(x);
        const parsed = questionsSchema.safeParse(saved);
        if (parsed.success) return parsed.data;
        // Keep every question that still loads instead of breaking the app
        return (Array.isArray(saved) ? saved : []).flatMap((question) => {
            const one = questionSchema.safeParse(question);
            return one.success ? [one.data] : [];
        });
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
/** On: the map keeps your own position (the blue dot) in the middle. */
export const followMyPosition = atom<boolean>(true);
/** A question the seekers sent to the hider as a link. */
export type HiderInboxEntry = {
    question: Question;
    /** The question's number on the seekers' phone. */
    number?: number;
    receivedAt: number;
    /** The answer the app worked out last, like "Outside". */
    answer?: string;
};
/** Questions the hider got on this phone, newest last. */
export const hiderInbox = persistentAtom<HiderInboxEntry[]>("hiderInbox", [], {
    encode: JSON.stringify,
    decode: JSON.parse,
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
/** The hiding zone shown on its own (its station's id), or "" for all zones. */
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
export const mergeDuplicates = persistentAtom<boolean>(
    "removeDuplicates",
    false,
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
    kilometers: number;
} | null>("thermometerRun", null, {
    encode: JSON.stringify,
    decode: JSON.parse,
});

export const showTutorial = persistentAtom<boolean>("showTutorials", false, {
    encode: JSON.stringify,
    decode: JSON.parse,
});
export const tutorialStep = atom<number>(0);

export const overpassHost = persistentAtom<string>(
    "overpassHost",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
);
export const overpassCustomHost = persistentAtom<string>(
    "overpassCustomHost",
    "",
);
