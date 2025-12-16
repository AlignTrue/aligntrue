import { describe, expect, it } from "vitest";

import { agentOptions } from "./agents";
import { SUPPORTED_AGENT_IDS } from "./convert";

describe("agentOptions", () => {
  it("includes every supported agent id", () => {
    const optionIds = agentOptions.map((opt) => opt.id);
    expect(optionIds).toEqual(SUPPORTED_AGENT_IDS);
  });

  it("omits exporter for default while keeping CLI export enabled", () => {
    const defaultAgent = agentOptions.find((opt) => opt.id === "default");
    expect(defaultAgent?.capabilities.cliExport).toBe(true);
    expect(defaultAgent?.exporter).toBeUndefined();
  });

  it("enables cliExport for all non-default agents", () => {
    const others = agentOptions.filter((opt) => opt.id !== "default");
    expect(others.every((opt) => opt.capabilities.cliExport)).toBe(true);
  });
});
