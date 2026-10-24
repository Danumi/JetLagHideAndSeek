import * as turf from "@turf/turf";
import { afterEach, describe, expect, it } from "vitest";

import { hiderMode } from "@/lib/context";
import { applyQuestionsToMapGeoData } from "@/maps";
import {
    endPreview,
    movePreview,
    PREVIEW_KEY,
    previewCut,
    previewForMap,
    previewKey,
    questionPreview,
    showPreviewAnswer,
    startPreview,
    withPreview,
} from "@/maps/preview";
import { questionSchema } from "@/maps/schema";

const KARLSPLATZ = { lat: 48.2003, lng: 16.3697 };

const radar = {
    id: "radius",
    data: { radius: 2, unit: "kilometers" },
} as const;

afterEach(() => {
    endPreview();
    hiderMode.set(false);
});

describe("just look at a question", () => {
    it("shows it answered with the first answer, under its own key", () => {
        startPreview(radar, KARLSPLATZ, true);
        const shown = previewForMap()!;
        expect(shown.question.key).toBe(PREVIEW_KEY);
        expect(shown.question.data.status).toBe("answered");
        expect(
            shown.question.id === "radius" && shown.question.data.within,
        ).toBe(true);
    });

    it("shows another answer", () => {
        startPreview(radar, KARLSPLATZ, true);
        const before = previewKey(questionPreview.get());
        showPreviewAnswer("outside");
        const shown = previewForMap()!;
        expect(
            shown.question.id === "radius" && shown.question.data.within,
        ).toBe(false);
        expect(shown.key).not.toBe(before);
    });

    it("doesn't change the question kept for the preview", () => {
        startPreview(radar, KARLSPLATZ, true);
        previewForMap();
        expect(questionPreview.get()!.question.data.status).toBe("answered");
        expect(questionPreview.get()!.answer).toBe("inside");
    });

    it("moves with its pin, then isn't where this phone is any more", () => {
        startPreview(radar, KARLSPLATZ, true);
        movePreview({ lat: 48.21, lng: 16.38 });
        const preview = questionPreview.get()!;
        expect(preview.atMyLocation).toBe(false);
        expect(
            preview.question.id === "radius" && preview.question.data.lat,
        ).toBe(48.21);
        expect(preview.answer).toBe("inside");
    });

    it("comes last among the questions that change the map", () => {
        const asked = questionSchema.parse({
            id: "radius",
            data: { ...KARLSPLATZ, status: "answered" },
        });
        startPreview(radar, KARLSPLATZ, true);
        expect(withPreview([asked]).map((q) => q.key)).toEqual([
            asked.key,
            PREVIEW_KEY,
        ]);
        endPreview();
        expect(withPreview([asked])).toEqual([asked]);
    });

    it("isn't on the hider's phone", () => {
        startPreview(radar, KARLSPLATZ, true);
        hiderMode.set({ latitude: 48.2, longitude: 16.37 });
        expect(previewForMap()).toBeNull();
        expect(questionPreview.get()).toBeNull();
    });
});

describe("what the answer looked at rules out", () => {
    const AREA = turf.featureCollection([
        turf.bboxPolygon([16.18, 48.12, 16.58, 48.32]),
    ]);

    it("is what was left before but not after", () => {
        const after = turf.featureCollection([
            turf.bboxPolygon([16.18, 48.12, 16.38, 48.32]),
        ]);
        const cut = previewCut(AREA, after)!;
        expect(turf.area(cut)).toBeCloseTo(turf.area(AREA) / 2, -6);
        expect(turf.booleanPointInPolygon([16.5, 48.2], cut)).toBe(true);
        expect(turf.booleanPointInPolygon([16.25, 48.2], cut)).toBe(false);
    });

    it("is everything when the answer leaves nothing", () => {
        const cut = previewCut(AREA, turf.featureCollection([]))!;
        expect(turf.area(cut)).toBeCloseTo(turf.area(AREA), -6);
    });

    it("together with what's left is the area before", async () => {
        const thermometer = questionSchema.parse({
            id: "thermometer",
            data: {
                latA: 48.2,
                lngA: 16.3,
                latB: 48.21,
                lngB: 16.31,
                warmer: true,
                status: "answered",
                drag: false,
            },
        });
        const after = await applyQuestionsToMapGeoData(
            [thermometer],
            AREA,
            false,
        );
        const cut = previewCut(AREA, after)!;
        expect(turf.area(cut) + turf.area(after)).toBeCloseTo(
            turf.area(AREA),
            -6,
        );
    });
});
