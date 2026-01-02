/**
 * Tests for documentation link integrity
 *
 * Ensures all internal /docs/ links point to existing files.
 */

import { describe, it, expect } from "vitest";
import { checkAllLinks, getLinkStats } from "../lib/check-links.js";

describe("Documentation Links", () => {
  it("should have no broken internal links", () => {
    const brokenLinks = checkAllLinks();

    if (brokenLinks.length > 0) {
      const errorMessages = brokenLinks.map(
        (link) =>
          `${link.file}:${link.line} - [${link.linkText}](${link.linkPath}) -> ${link.expectedFile} (not found)`,
      );

      expect.fail(
        `Found ${brokenLinks.length} broken link(s):\n\n${errorMessages.join("\n")}`,
      );
    }

    expect(brokenLinks).toHaveLength(0);
  });

  it("should find and check internal links", () => {
    const stats = getLinkStats();

    // Sanity check: we should have files and links
    expect(stats.totalFiles).toBeGreaterThan(0);
    expect(stats.totalLinks).toBeGreaterThan(0);

    // Log stats for visibility
    console.log(
      `✓ Checked ${stats.totalLinks} links across ${stats.totalFiles} files`,
    );
  });
});
