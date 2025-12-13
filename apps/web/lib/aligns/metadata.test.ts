import { describe, expect, it } from "vitest";
import { extractMetadata } from "./metadata";

describe("extractMetadata (markdown)", () => {
  const normalizedUrl = "https://github.com/org/repo/blob/main/file.md";

  it("uses frontmatter title when present", () => {
    const content = `---
title: Frontmatter Title
description: A description
---
# Heading Title

Body text.`;

    const meta = extractMetadata(normalizedUrl, content);
    expect(meta.title).toBe("Frontmatter Title");
    expect(meta.description).toBe("A description");
  });

  it("falls back to first heading when title is absent", () => {
    const content = `---
description: Only description
---
# Heading Fallback

Body text.`;

    const meta = extractMetadata(normalizedUrl, content);
    expect(meta.title).toBe("Heading Fallback");
    expect(meta.description).toBe("Only description");
  });

  it("returns null title when no title or heading is present", () => {
    const content = `---
description: Only description
---
Body text without heading.`;

    const meta = extractMetadata(normalizedUrl, content);
    expect(meta.title).toBeNull();
    expect(meta.description).toBe("Only description");
  });

  it("falls back gracefully on malformed YAML frontmatter", () => {
    const content = `---
globs: **/*.templ
---
# Fallback Heading

Body text.`;

    const meta = extractMetadata(normalizedUrl, content);
    expect(meta.title).toBe("Fallback Heading");
    expect(meta.description).toBeNull();
  });

  it("ignores frontmatter when searching for fallback heading", () => {
    const content = `---
globs: **/*.templ
# not a real heading
---
# Real Heading

Body text.`;

    const meta = extractMetadata(normalizedUrl, content);
    expect(meta.title).toBe("Real Heading");
    expect(meta.description).toBeNull();
  });

  it("returns null title when closing fence is missing", () => {
    const content = `---
key: value
# yaml comment
Body text without closing fence.`;

    const meta = extractMetadata(normalizedUrl, content);
    expect(meta.title).toBeNull();
    expect(meta.description).toBeNull();
  });
});

describe("extractMetadata (xml)", () => {
  it("uses filename as title for XML files", () => {
    const url = "https://github.com/org/repo/blob/main/cursor_rule.xml";
    const meta = extractMetadata(url, "<root>content</root>");
    expect(meta.title).toBe("cursor_rule.xml");
    expect(meta.description).toBeNull();
    expect(meta.fileType).toBe("xml");
  });
});
