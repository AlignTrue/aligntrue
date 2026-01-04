import { describe, expect, it } from "vitest";

import {
  redactString,
  summarizeToolArgs,
  summarizeToolResult,
  DEFAULT_REDACTION,
} from "../src/trajectories/redaction.js";

describe("redaction utilities", () => {
  it("redacts emails and tokens", () => {
    const input =
      "Contact me at test@example.com with token ghp_abcd1234 and api key sk-abc";
    const out = redactString(input);
    expect(out).not.toContain("test@example.com");
    expect(out).not.toContain("ghp_abcd");
    expect(out).not.toContain("sk-abc");
    expect(out).toContain(DEFAULT_REDACTION.replacement);
  });

  it("truncates long summaries", () => {
    const long = "x".repeat(DEFAULT_REDACTION.max_summary_length + 50);
    const out = redactString(long);
    expect(out.length).toBeLessThanOrEqual(
      DEFAULT_REDACTION.max_summary_length + 1,
    );
  });

  it("summarizes args and results", () => {
    const args = { email: "test@example.com" };
    const res = summarizeToolArgs(args);
    expect(res).not.toContain("test@example.com");

    const result = { token: "ghp_abcd" };
    const res2 = summarizeToolResult(result);
    expect(res2).not.toContain("ghp_abcd");
  });
});
