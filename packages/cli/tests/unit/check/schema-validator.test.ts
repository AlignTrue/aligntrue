import { describe, expect, it } from "vitest";
import type { Align } from "@aligntrue/schema";
import { validateSchema } from "../../../src/commands/check/schema-validator.js";

describe("schema-validator", () => {
  it("returns valid for minimal align with sections", () => {
    const align: Align = {
      id: "test-align",
      version: "0.0.0",
      spec_version: "1",
      sections: [],
    };

    const result = validateSchema(align);

    expect(result.valid).toBe(true);
  });

  it("returns errors for invalid align", () => {
    const align = {} as Align;

    const result = validateSchema(align);

    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it("reports missing id field", () => {
    const align = {
      version: "0.0.0",
      spec_version: "1",
      sections: [],
    } as unknown as Align;

    const result = validateSchema(align);

    expect(result.valid).toBe(false);
    expect(result.errors?.some((msg) => msg.includes("id"))).toBe(true);
  });

  it("reports missing spec_version field", () => {
    const align = {
      id: "test-align",
      version: "0.0.0",
      sections: [],
    } as unknown as Align;

    const result = validateSchema(align);

    expect(result.valid).toBe(false);
    expect(result.errors?.some((msg) => msg.includes("spec_version"))).toBe(
      true,
    );
  });

  it("reports invalid spec_version value", () => {
    const align = {
      id: "test-align",
      version: "0.0.0",
      spec_version: "999",
      sections: [],
    } as unknown as Align;

    const result = validateSchema(align);

    expect(result.valid).toBe(false);
    expect(
      result.errors?.some((msg) => msg.toLowerCase().includes("spec_version")),
    ).toBe(true);
  });

  it("reports malformed sections array entries", () => {
    const align = {
      id: "test-align",
      version: "0.0.0",
      spec_version: "1",
      sections: [
        // Missing required heading/content structure
        {} as unknown as Align["sections"][number],
      ],
    } as unknown as Align;

    const result = validateSchema(align);

    expect(result.valid).toBe(false);
    expect(
      result.errors?.some((msg) => msg.toLowerCase().includes("sections")),
    ).toBe(true);
  });
});
