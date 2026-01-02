import { describe, expect, it } from "vitest";

import { parseFrontmatter, isAgentId, SUPPORTED_AGENT_IDS } from "./convert";

const baseContent = `---
title: Test Title
description: Test Description
---

# Heading

Body text.
`;

describe("parseFrontmatter", () => {
  it("returns data and body for valid frontmatter", () => {
    const result = parseFrontmatter(baseContent);
    expect(result.data).toEqual({
      title: "Test Title",
      description: "Test Description",
    });
    expect(result.body.trim()).toContain("Body text.");
  });

  it("handles missing closing fence gracefully", () => {
    const noClosing = `---
key: value
Body text without closing fence.`;

    const result = parseFrontmatter(noClosing);
    expect(result.data).toEqual({});
    expect(result.body).toBe("");
  });
});

describe("isAgentId", () => {
  it("returns true for supported ids", () => {
    for (const id of SUPPORTED_AGENT_IDS) {
      expect(isAgentId(id)).toBe(true);
    }
  });

  it("returns false for unsupported ids", () => {
    expect(isAgentId("not-real")).toBe(false);
  });
});
