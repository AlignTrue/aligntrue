/**
 * Test for edit preservation during sync
 * Verifies that user edits to existing sections are preserved
 */

import { describe, it, expect } from "vitest";
import { matchSections } from "../src/utils/section-matcher.js";
import type { AlignSection } from "@aligntrue/schema";
import type { ParsedSection } from "../src/utils/section-parser.js";

describe("Edit Preservation", () => {
  it("should preserve sections with vendor.aligntrue.last_modified metadata", () => {
    // IR sections with last_modified metadata (indicating user edit)
    const irSections: AlignSection[] = [
      {
        heading: "Test Section",
        content: "Updated content from user edit",
        level: 2,
        fingerprint: "abc123",
        vendor: {
          aligntrue: {
            source_file: ".cursor/rules/aligntrue.mdc",
            last_modified: "2025-11-13T16:30:00.000Z",
          },
        },
      },
    ];

    // Existing sections in file (old content)
    const existingSections: ParsedSection[] = [
      {
        heading: "Test Section",
        content: "Old content before edit",
        level: 2,
        hash: "def456",
      },
    ];

    const { matches, stats } = matchSections(irSections, existingSections);

    // Should mark as "preserve-edit" not "update"
    expect(matches).toHaveLength(1);
    expect(matches[0]?.action).toBe("preserve-edit");
    expect(matches[0]?.reason).toContain("User edited");
    expect(stats.preservedEdits).toBe(1);
    expect(stats.updated).toBe(0);
  });

  it("should update sections without last_modified metadata", () => {
    // IR sections without last_modified (normal IR update)
    const irSections: AlignSection[] = [
      {
        heading: "Test Section",
        content: "Updated content from IR",
        level: 2,
        fingerprint: "abc123",
      },
    ];

    // Existing sections in file
    const existingSections: ParsedSection[] = [
      {
        heading: "Test Section",
        content: "Old content",
        level: 2,
        hash: "def456",
      },
    ];

    const { matches, stats } = matchSections(irSections, existingSections);

    // Should mark as "update" (normal behavior)
    expect(matches).toHaveLength(1);
    expect(matches[0]?.action).toBe("update");
    expect(stats.updated).toBe(1);
    expect(stats.preservedEdits).toBe(0);
  });

  it("should keep sections when content matches", () => {
    // Compute the actual hash for matching content
    const { createHash } = require("crypto");
    const content = "Same content";
    const heading = "Test Section";
    const normalized = `${heading}\n${content}`.trim();
    const actualHash = createHash("sha256")
      .update(normalized, "utf-8")
      .digest("hex");

    const irSections: AlignSection[] = [
      {
        heading,
        content,
        level: 2,
        fingerprint: "abc123",
      },
    ];

    const existingSections: ParsedSection[] = [
      {
        heading,
        content,
        level: 2,
        hash: actualHash,
      },
    ];

    const { matches, stats } = matchSections(irSections, existingSections);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.action).toBe("keep");
    expect(stats.kept).toBe(1);
    expect(stats.updated).toBe(0);
    expect(stats.preservedEdits).toBe(0);
  });

  it("should preserve user-added sections", () => {
    const irSections: AlignSection[] = [];

    const existingSections: ParsedSection[] = [
      {
        heading: "User Added Section",
        content: "This was added by the user",
        level: 2,
        hash: "xyz789",
      },
    ];

    const { matches, stats } = matchSections(irSections, existingSections);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.action).toBe("user-added");
    expect(stats.userAdded).toBe(1);
  });
});
