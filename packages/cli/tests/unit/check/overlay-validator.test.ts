import { describe, expect, it } from "vitest";
import type { AlignTrueConfig } from "@aligntrue/core";
import type { Align } from "@aligntrue/schema";
import { validateOverlaysConfig } from "../../../src/commands/check/overlay-validator.js";

describe("overlay-validator", () => {
  it("returns valid when no overlays are configured", () => {
    const config = { mode: "solo" } as AlignTrueConfig;
    const align: Align = { sections: [] };

    const result = validateOverlaysConfig(config, align);

    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });
});
