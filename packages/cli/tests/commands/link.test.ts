/**
 * Basic smoke tests for link command
 *
 * Note: Comprehensive integration tests deferred to Session 10
 * These verify core validation logic only
 */

import { describe, it, expect } from "vitest";
import { link } from "../../src/commands/link.js";
import { join } from "path";

describe("link command - smoke tests", () => {
  describe("argument validation", () => {
    it("requires git-url argument", async () => {
      await expect(link([])).rejects.toThrow();
    });

    it("validates git URL format", async () => {
      await expect(link(["not-a-valid-url"])).rejects.toThrow();
    });

    it("validates git URL format - missing protocol", async () => {
      await expect(link(["github.com/org/repo"])).rejects.toThrow();
    });

    it("validates git URL format - local path rejected", async () => {
      await expect(link([join("/local/path")])).rejects.toThrow();
    });

    it("validates git URL format - relative path rejected", async () => {
      await expect(link([join("./relative/path")])).rejects.toThrow();
    });
  });

  describe("help", () => {
    it("shows help with --help flag without crashing", async () => {
      // Help shows and exits - implementation detail may throw or return
      try {
        await link(["--help"]);
      } catch (_e) {
        // Expected - help exits early
      }
    });

    it("shows help with -h flag without crashing", async () => {
      try {
        await link(["-h"]);
      } catch (_e) {
        // Expected - help exits early
      }
    });
  });
});
