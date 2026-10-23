import { describe, expect, it } from "vitest";

import { closesSheet } from "@/lib/sheetSwipe";

/** The question list on a phone: as wide as the screen. */
const phone = { width: 390, speed: 0 };

describe("swiping the question list closed", () => {
    it("closes after a quarter of its width", () => {
        expect(closesSheet({ ...phone, distance: 100 })).toBe(true);
        expect(closesSheet({ ...phone, distance: 90 })).toBe(false);
    });

    it("closes with a short flick", () => {
        expect(closesSheet({ ...phone, distance: 30, speed: 0.6 })).toBe(true);
    });

    it("stays open after a short, slow swipe", () => {
        expect(closesSheet({ ...phone, distance: 60, speed: 0.1 })).toBe(false);
    });

    it("stays open when the flick went back", () => {
        expect(closesSheet({ ...phone, distance: 60, speed: -0.8 })).toBe(
            false,
        );
    });

    it("does not count a tiny twitch as a flick", () => {
        expect(closesSheet({ ...phone, distance: 10, speed: 2 })).toBe(false);
    });
});
