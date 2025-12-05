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
});
