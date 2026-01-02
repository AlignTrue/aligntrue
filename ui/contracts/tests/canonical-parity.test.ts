/// <reference types="vitest" />

import { describe, expect, it } from "vitest";
import { Identity } from "@aligntrue/core";
import { canonicalize as uiCanonicalize } from "../src/canonical.js";

const coreCanonicalize = Identity.canonicalize;

const cases: Array<{ name: string; value: unknown }> = [
  { name: "simple object", value: { b: 2, a: 1 } },
  { name: "nested object", value: { a: { z: 1, y: [3, 2, 1] }, b: null } },
  { name: "array", value: [3, 1, 2] },
  { name: "mixed primitives", value: { flag: true, count: 4, text: "hi" } },
  {
    name: "null prototype guard",
    value: Object.assign(Object.create(null), { a: 1, b: 2 }),
  },
];

describe("canonicalize parity (core vs ui-contracts)", () => {
  it("produces identical output for representative cases", () => {
    for (const testCase of cases) {
      const core = coreCanonicalize(testCase.value);
      const ui = uiCanonicalize(testCase.value);
      expect(ui).toBe(core);
    }
  });
});
