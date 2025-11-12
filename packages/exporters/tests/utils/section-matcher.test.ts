/**
 * Tests for section matcher utility
 */

import { describe, it, expect } from "vitest";
import {
  matchSections,
  parsedToAlignSection,
} from "../../src/utils/section-matcher.js";
import type { AlignSection } from "@aligntrue/schema";
import type { ParsedSection } from "../../src/utils/section-parser.js";

describe("matchSections", () => {
  it("should match identical sections as 'keep'", () => {
    // Hash: SHA256("Testing\nRun tests before committing.")
    const correctHash =
      "fdbc822386ef01243069875b4fb5071d384149e3bed5ed96cf6528a256cd9a8b";

    const irSections: AlignSection[] = [
      {
        heading: "Testing",
        content: "Run tests before committing.",
        level: 2,
      },
    ];

    const existingSections: ParsedSection[] = [
      {
        id: "testing",
        heading: "Testing",
        content: "Run tests before committing.",
        level: 2,
        hash: correctHash,
        startLine: 1,
        endLine: 3,
      },
    ];

    const { matches, stats } = matchSections(irSections, existingSections);

    expect(stats.kept).toBe(1);
    expect(stats.updated).toBe(0);
    expect(stats.added).toBe(0);
    expect(stats.userAdded).toBe(0);
    expect(matches[0]?.action).toBe("keep");
  });

  it("should match modified sections as 'update'", () => {
    // Hash: SHA256("Testing\nRun tests before committing.") - old content
    const oldHash =
      "fdbc822386ef01243069875b4fb5071d384149e3bed5ed96cf6528a256cd9a8b";

    const irSections: AlignSection[] = [
      {
        heading: "Testing",
        content: "Run all tests before committing.",
        level: 2,
      },
    ];

    const existingSections: ParsedSection[] = [
      {
        id: "testing",
        heading: "Testing",
        content: "Run tests before committing.",
        level: 2,
        hash: oldHash,
        startLine: 1,
        endLine: 3,
      },
    ];

    const { matches, stats } = matchSections(irSections, existingSections);

    expect(stats.kept).toBe(0);
    expect(stats.updated).toBe(1);
    expect(stats.added).toBe(0);
    expect(stats.userAdded).toBe(0);
    expect(matches[0]?.action).toBe("update");
  });

  it("should detect new IR sections as 'add'", () => {
    // Hash: SHA256("Testing\nRun tests.")
    const testingHash =
      "79e78ab26de582b5655a6467f857d2167570dc82fb3a7be9d06699dc6ada61b4";

    const irSections: AlignSection[] = [
      {
        heading: "Testing",
        content: "Run tests.",
        level: 2,
      },
      {
        heading: "Documentation",
        content: "Write docs.",
        level: 2,
      },
    ];

    const existingSections: ParsedSection[] = [
      {
        id: "testing",
        heading: "Testing",
        content: "Run tests.",
        level: 2,
        hash: testingHash,
        startLine: 1,
        endLine: 3,
      },
    ];

    const { matches, stats } = matchSections(irSections, existingSections);

    expect(stats.kept).toBe(1);
    expect(stats.added).toBe(1);
    expect(matches.length).toBe(2);
    expect(matches[1]?.action).toBe("add");
    expect(matches[1]?.irSection?.heading).toBe("Documentation");
  });

  it("should preserve user-added sections", () => {
    const irSections: AlignSection[] = [
      {
        heading: "Testing",
        content: "Run tests.",
        level: 2,
      },
    ];

    const existingSections: ParsedSection[] = [
      {
        id: "testing",
        heading: "Testing",
        content: "Run tests.",
        level: 2,
        hash: "abc123",
        startLine: 1,
        endLine: 3,
      },
      {
        id: "my-notes",
        heading: "My Notes",
        content: "Personal workflow notes.",
        level: 2,
        hash: "def456",
        startLine: 5,
        endLine: 7,
      },
    ];

    const { matches, stats } = matchSections(irSections, existingSections);

    expect(stats.userAdded).toBe(1);
    expect(matches.length).toBe(2);

    const userSection = matches.find((m) => m.action === "user-added");
    expect(userSection).toBeDefined();
    expect(userSection?.existingSection?.heading).toBe("My Notes");
  });

  it("should handle team-managed sections", () => {
    const irSections: AlignSection[] = [
      {
        heading: "Security",
        content: "Validate all input.",
        level: 2,
      },
    ];

    const existingSections: ParsedSection[] = [];

    const managedSections = ["Security"];

    const { matches } = matchSections(
      irSections,
      existingSections,
      managedSections,
    );

    expect(matches[0]?.isTeamManaged).toBe(true);
  });

  it("should handle case-insensitive heading matching", () => {
    // Hash: SHA256("Testing\nRun tests.")
    const correctHash =
      "79e78ab26de582b5655a6467f857d2167570dc82fb3a7be9d06699dc6ada61b4";

    const irSections: AlignSection[] = [
      {
        heading: "Testing",
        content: "Run tests.",
        level: 2,
      },
    ];

    const existingSections: ParsedSection[] = [
      {
        id: "testing",
        heading: "TESTING",
        content: "Run tests.",
        level: 2,
        hash: correctHash,
        startLine: 1,
        endLine: 3,
      },
    ];

    const { matches, stats } = matchSections(irSections, existingSections);

    expect(stats.kept).toBe(1);
    expect(matches[0]?.action).toBe("keep");
  });
});

describe("parsedToAlignSection", () => {
  it("should convert ParsedSection to AlignSection", () => {
    const parsed: ParsedSection = {
      id: "testing",
      heading: "Testing",
      content: "Run tests.",
      level: 2,
      hash: "abc123",
      startLine: 1,
      endLine: 3,
    };

    const align = parsedToAlignSection(parsed);

    expect(align.heading).toBe("Testing");
    expect(align.content).toBe("Run tests.");
    expect(align.level).toBe(2);
  });
});

describe("Advanced matching scenarios", () => {
  it("should handle multiple team-managed sections", () => {
    const irSections: AlignSection[] = [
      {
        heading: "Security",
        content: "Validate input.",
        level: 2,
      },
      {
        heading: "Compliance",
        content: "Follow SOC2.",
        level: 2,
      },
      {
        heading: "Testing",
        content: "Run tests.",
        level: 2,
      },
    ];

    const existingSections: ParsedSection[] = [];
    const managedSections = ["Security", "Compliance"];

    const { matches } = matchSections(
      irSections,
      existingSections,
      managedSections,
    );

    expect(matches[0]?.isTeamManaged).toBe(true);
    expect(matches[1]?.isTeamManaged).toBe(true);
    expect(matches[2]?.isTeamManaged).toBeFalsy();
  });

  it("should preserve stats accuracy with mixed operations", () => {
    // Hashes: SHA256("Testing\nRun tests."), SHA256("Documentation\nOld docs.")
    const testingHash =
      "79e78ab26de582b5655a6467f857d2167570dc82fb3a7be9d06699dc6ada61b4";
    const oldDocsHash =
      "f450173bfc5df6a25fa54cce750ef8106b09e8584a42f9e31dd714a58de77d28";

    const irSections: AlignSection[] = [
      {
        heading: "Testing",
        content: "Run tests.",
        level: 2,
      },
      {
        heading: "Security",
        content: "New security rules.",
        level: 2,
      },
      {
        heading: "Documentation",
        content: "Updated docs.",
        level: 2,
      },
    ];

    const existingSections: ParsedSection[] = [
      {
        id: "testing",
        heading: "Testing",
        content: "Run tests.",
        level: 2,
        hash: testingHash,
        startLine: 1,
        endLine: 3,
      },
      {
        id: "documentation",
        heading: "Documentation",
        content: "Old docs.",
        level: 2,
        hash: oldDocsHash,
        startLine: 5,
        endLine: 7,
      },
      {
        id: "my-notes",
        heading: "My Notes",
        content: "Personal notes.",
        level: 2,
        hash: "user-hash-arbitrary",
        startLine: 9,
        endLine: 11,
      },
    ];

    const { stats } = matchSections(irSections, existingSections);

    expect(stats.kept).toBe(1); // Testing unchanged
    expect(stats.updated).toBe(1); // Documentation changed
    expect(stats.added).toBe(1); // Security is new
    expect(stats.userAdded).toBe(1); // My Notes preserved
  });

  it("should handle empty existing sections", () => {
    const irSections: AlignSection[] = [
      {
        heading: "Testing",
        content: "Run tests.",
        level: 2,
      },
    ];

    const existingSections: ParsedSection[] = [];

    const { matches, stats } = matchSections(irSections, existingSections);

    expect(stats.added).toBe(1);
    expect(stats.kept).toBe(0);
    expect(stats.updated).toBe(0);
    expect(stats.userAdded).toBe(0);
    expect(matches[0]?.action).toBe("add");
  });

  it("should handle empty IR sections", () => {
    const irSections: AlignSection[] = [];

    const existingSections: ParsedSection[] = [
      {
        id: "my-notes",
        heading: "My Notes",
        content: "Personal notes.",
        level: 2,
        hash: "user-hash",
        startLine: 1,
        endLine: 3,
      },
    ];

    const { matches, stats } = matchSections(irSections, existingSections);

    expect(stats.userAdded).toBe(1);
    expect(stats.added).toBe(0);
    expect(stats.kept).toBe(0);
    expect(stats.updated).toBe(0);
    expect(matches[0]?.action).toBe("user-added");
  });

  it("should match headings with whitespace differences", () => {
    // Hash: SHA256("Testing\nRun tests.")
    const correctHash =
      "79e78ab26de582b5655a6467f857d2167570dc82fb3a7be9d06699dc6ada61b4";

    const irSections: AlignSection[] = [
      {
        heading: "Testing",
        content: "Run tests.",
        level: 2,
      },
    ];

    const existingSections: ParsedSection[] = [
      {
        id: "testing",
        heading: "  Testing  ",
        content: "Run tests.",
        level: 2,
        hash: correctHash,
        startLine: 1,
        endLine: 3,
      },
    ];

    const { matches, stats } = matchSections(irSections, existingSections);

    expect(stats.kept).toBe(1);
    expect(matches[0]?.action).toBe("keep");
  });
});
