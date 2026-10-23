import { describe, expect, it } from "vitest";

import { type Swipe, swipeAway } from "@/lib/toastSwipe";

/** A status message on a phone: nearly as wide as the screen. */
const phone = { width: 375, height: 50, vx: 0, vy: 0, dx: 0, dy: 0 };
const swipe = (s: Partial<Swipe> & Pick<Swipe, "axis">) =>
    swipeAway({ ...phone, ...s });

describe("swiping a status message away", () => {
    it("goes with a quarter of its width sideways", () => {
        expect(swipe({ axis: "x", dx: 100 })).toBe("right");
        expect(swipe({ axis: "x", dx: -100 })).toBe("left");
    });

    it("comes back after a short, slow swipe", () => {
        expect(swipe({ axis: "x", dx: 60, vx: 0.1 })).toBeNull();
        expect(swipe({ axis: "x", dx: -60, vx: -0.1 })).toBeNull();
    });

    it("goes with a short flick", () => {
        expect(swipe({ axis: "x", dx: 40, vx: 0.8 })).toBe("right");
        expect(swipe({ axis: "x", dx: -40, vx: -0.8 })).toBe("left");
    });

    it("comes back when the flick was back towards the start", () => {
        expect(swipe({ axis: "x", dx: 40, vx: -0.8 })).toBeNull();
    });

    it("does not count a tiny twitch as a flick", () => {
        expect(swipe({ axis: "x", dx: 10, vx: 2 })).toBeNull();
    });

    it("goes upwards, but never downwards", () => {
        expect(swipe({ axis: "y", dy: -30 })).toBe("up");
        expect(swipe({ axis: "y", dy: -25, vy: -0.8 })).toBe("up");
        expect(swipe({ axis: "y", dy: -15, vy: -0.1 })).toBeNull();
        expect(swipe({ axis: "y", dy: 200, vy: 2 })).toBeNull();
    });
});
