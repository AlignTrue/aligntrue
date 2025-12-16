import { describe, expect, it } from "vitest";

import { agentOptions } from "./agents";
import { SUPPORTED_AGENT_IDS } from "./convert";

describe("agentOptions", () => {
  it("includes every supported agent id", () => {
    const optionIds = agentOptions.map((opt) => opt.id);
    expect(optionIds).toEqual(SUPPORTED_AGENT_IDS);
  });

  it("marks original as non-CLI-exportable", () => {
    const original = agentOptions.find((opt) => opt.id === "original");
    expect(original?.capabilities.cliExport).toBe(false);
  });

  it("omits exporter for original since it is not CLI-exportable", () => {
    const original = agentOptions.find((opt) => opt.id === "original");
    expect(original?.exporter).toBeUndefined();
  });

  it("marks aligntrue as non-CLI-exportable", () => {
    const aligntrue = agentOptions.find((opt) => opt.id === "aligntrue");
    expect(aligntrue?.capabilities.cliExport).toBe(false);
  });

  it("defaults other agents to cliExport true", () => {
    const others = agentOptions.filter(
      (opt) => opt.id !== "aligntrue" && opt.id !== "original",
    );
    expect(others.every((opt) => opt.capabilities.cliExport)).toBe(true);
  });
});
