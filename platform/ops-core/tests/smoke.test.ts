import { describe, expect, it } from "vitest";
import { OPS_CORE_ENABLED, OpsError } from "../src/index.js";

describe("ops-core smoke", () => {
  it("exports feature flag (default off)", () => {
    expect(typeof OPS_CORE_ENABLED).toBe("boolean");
    expect(OPS_CORE_ENABLED).toBe(false);
  });

  it("exports OpsError class", () => {
    const err = new OpsError("test", "TEST_CODE", { key: "value" });
    expect(err.code).toBe("TEST_CODE");
    expect(err.context).toEqual({ key: "value" });
  });
});
