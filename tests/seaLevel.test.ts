import { describe, expect, it } from "vitest";

import { SEA_LEVEL_MARGIN_METERS, seaLevelLimit } from "@/maps/api/elevation";

describe("sea level on the map", () => {
    it("keeps ground a little higher light when the hider is lower", () => {
        expect(seaLevelLimit(180, true)).toBe(180 + SEA_LEVEL_MARGIN_METERS);
    });

    it("keeps ground a little lower light when the hider is higher", () => {
        expect(seaLevelLimit(180, false)).toBe(180 - SEA_LEVEL_MARGIN_METERS);
    });
});
