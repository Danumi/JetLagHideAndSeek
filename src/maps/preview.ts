import * as turf from "@turf/turf";
import type {
    Feature,
    FeatureCollection,
    MultiPolygon,
    Polygon,
} from "geojson";
import { atom } from "nanostores";

import { hiderMode } from "@/lib/context";

import { answerOptions, setAnswer } from "./answers";
import type { StationCircle } from "./api";
import { safeUnion } from "./geo-utils";
import { type DeepPartial, type Question, questionSchema } from "./schema";

/*
 * "Just look": a question the seekers look at without asking it. The map
 * shows what one of its answers would rule out. Only on this phone: not
 * saved, not among the questions, never sent to the hider or to the other
 * connected phones (also on a phone that shows another seeker's map).
 */

/** The preview's key: no real question has it (the hider's H marker is -1). */
export const PREVIEW_KEY = -2;

export type QuestionPreview = {
    /** What "Ask this question" asks, without the location. */
    card: DeepPartial<Question>;
    question: Question;
    /** The answer the map shows. */
    answer: string;
    /** Still where this phone was: "Ask this question" asks it here. */
    atMyLocation: boolean;
    /** When the question was picked: the map shows all of the area once. */
    startedAt: number;
};

export const questionPreview = atom<QuestionPreview | null>(null);

// The hider doesn't ask questions
hiderMode.listen((hider) => {
    if (hider !== false) questionPreview.set(null);
});

const parsePreview = (
    card: DeepPartial<Question>,
    at: { lat: number; lng: number },
) =>
    questionSchema.parse({
        ...card,
        key: PREVIEW_KEY,
        data: {
            ...card.data,
            lat: at.lat,
            lng: at.lng,
            status: "answered",
            drag: false,
        },
    });

/** Shows a question on the map without asking it, first with its first answer. */
export const startPreview = (
    card: DeepPartial<Question>,
    at: { lat: number; lng: number },
    atMyLocation: boolean,
) => {
    const question = parsePreview(card, at);
    questionPreview.set({
        card,
        question,
        answer: answerOptions(question)[0]?.value ?? "",
        atMyLocation,
        startedAt: Date.now(),
    });
};

export const showPreviewAnswer = (answer: string) => {
    const preview = questionPreview.get();
    if (preview) questionPreview.set({ ...preview, answer });
};

/** The preview's pin was moved, or put elsewhere with "Pick on map". */
export const movePreview = (at: { lat: number; lng: number }) => {
    const preview = questionPreview.get();
    if (!preview) return;
    questionPreview.set({
        ...preview,
        question: parsePreview(preview.card, at),
        atMyLocation: false,
    });
};

export const endPreview = () => questionPreview.set(null);

/** Tells what the map shows for a preview: its question and answer. */
export const previewKey = (preview: QuestionPreview | null) =>
    preview
        ? JSON.stringify([
              preview.question.id,
              preview.question.data,
              preview.answer,
          ])
        : "";

/**
 * The preview as a question answered with the answer shown, for the map;
 * null without a preview and on the hider's phone.
 */
export const previewForMap = (): {
    question: Question;
    key: string;
    startedAt: number;
} | null => {
    const preview = questionPreview.get();
    if (!preview || hiderMode.get() !== false) return null;
    const question = structuredClone(preview.question);
    setAnswer(question, preview.answer);
    return { question, key: previewKey(preview), startedAt: preview.startedAt };
};

/** The questions that change the map, with the preview answered last. */
export const withPreview = <T extends Question>(
    list: T[],
    preview = previewForMap(),
): Question[] => (preview ? [...list, preview.question] : list);

/**
 * What the preview's answer rules out on top of the answers so far: where
 * the hider could be before (`before`), but not after (`after`).
 */
export const previewCut = (
    before: FeatureCollection<Polygon | MultiPolygon>,
    after: FeatureCollection<Polygon | MultiPolygon>,
): Feature<Polygon | MultiPolygon> | null => {
    try {
        if (before.features.length === 0) return null;
        const was = safeUnion(before);
        if (after.features.length === 0) return was;
        return turf.difference(turf.featureCollection([was, safeUnion(after)]));
    } catch (error) {
        // The red is an extra: the map works without it
        console.log(error);
        return null;
    }
};

/** Lets the browser draw and answer taps between long steps of work. */
export const letTheAppBreathe = () =>
    new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Which preview the map data was worked out for (Map.tsx, HidingZones). */
const previewOfMapData = new WeakMap<object, string>();

export const markPreviewOnMap = (mapData: object, key: string) =>
    previewOfMapData.set(mapData, key);

export const previewOnMap = (mapData: object | null) =>
    (mapData && previewOfMapData.get(mapData)) ?? "";

/**
 * The preview whose zones are on the map: until then the count of zones
 * left is still the one before.
 */
export const previewZonesShown = atom<string>("");

/**
 * The zones the preview's answer rules out by their station (like the
 * length of its name), red on the map like the area it rules out.
 */
export const previewZonesRuledOut = atom<StationCircle[]>([]);
