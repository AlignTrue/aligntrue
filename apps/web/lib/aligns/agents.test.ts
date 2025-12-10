import { describe, expect, it } from "vitest";

import { agentOptions } from "./agents";
import { SUPPORTED_AGENT_IDS } from "./convert";

describe("agentOptions", () => {
  it("includes every supported agent id", () => {
    const optionIds = agentOptions.map((opt) => opt.id);
    expect(optionIds).toEqual(SUPPORTED_AGENT_IDS);
  });
});
