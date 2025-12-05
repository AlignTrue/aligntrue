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

  it("accepts a valid overlay targeting an existing section", () => {
    const config: AlignTrueConfig = {
      mode: "solo",
      overlays: {
        overrides: [
          {
            selector: 'sections[heading="Intro"]',
            set: { content: "Updated content" },
          },
        ],
      },
    };
    const align: Align = {
      sections: [{ heading: "Intro", content: "Original", fingerprint: "f1" }],
    };

    const result = validateOverlaysConfig(config, align);

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });

  it("reports stale selector errors for missing targets", () => {
    const config: AlignTrueConfig = {
      mode: "solo",
      overlays: {
        overrides: [
          {
            selector: 'sections[heading="Missing"]',
            set: { content: "noop" },
          },
        ],
      },
    };
    const align: Align = {
      sections: [{ heading: "Intro", content: "Original", fingerprint: "f1" }],
    };

    const result = validateOverlaysConfig(config, align);

    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
    expect(
      result.errors?.some((err) =>
        err.message?.toLowerCase().includes("does not match any"),
      ),
    ).toBe(true);
  });

  it("warns when approaching overlay count limits", () => {
    const config: AlignTrueConfig = {
      mode: "solo",
      overlays: {
        limits: { max_overrides: 2 },
        overrides: [
          {
            selector: 'sections[heading="Intro"]',
            set: { content: "Updated content" },
          },
          {
            selector: 'sections[heading="Details"]',
            set: { content: "More content" },
          },
        ],
      },
    };
    const align: Align = {
      sections: [
        { heading: "Intro", content: "Original", fingerprint: "f1" },
        { heading: "Details", content: "Original", fingerprint: "f2" },
      ],
    };

    const result = validateOverlaysConfig(config, align);

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
    expect(
      result.warnings.some((msg) =>
        msg.toLowerCase().includes("approaching overlay limit"),
      ),
    ).toBe(true);
  });

  it("errors when exceeding operations per overlay limit", () => {
    const config: AlignTrueConfig = {
      mode: "solo",
      overlays: {
        limits: { max_operations_per_override: 1 },
        overrides: [
          {
            selector: 'sections[heading="Intro"]',
            set: { content: "Updated", description: "Too many ops" },
          },
        ],
      },
    };
    const align: Align = {
      sections: [{ heading: "Intro", content: "Original", fingerprint: "f1" }],
    };

    const result = validateOverlaysConfig(config, align);

    expect(result.valid).toBe(false);
    expect(
      result.errors?.some((err) =>
        err.message?.toLowerCase().includes("operations"),
      ),
    ).toBe(true);
  });
});
