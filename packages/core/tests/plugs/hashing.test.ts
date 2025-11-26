import { describe, it, expect } from "vitest";
import {
  computePreResolutionHash,
  computePostResolutionHash,
  computeDualHash,
} from "../../src/plugs/hashing.js";
import type { Align } from "@aligntrue/schema";
import { cloneDeep } from "@aligntrue/schema";

describe("plugs hashing", () => {
  describe("computePreResolutionHash", () => {
    it("produces deterministic hash for align with plugs", () => {
      const align: Align = {
        id: "test/align",
        version: "1.0.0",
        spec_version: "1",
        plugs: {
          slots: {
            "test.cmd": {
              description: "Test command",
              format: "command",
              required: true,
            },
          },
        },
        sections: [
          {
            heading: "Test Rule",
            level: 2,
            content: "Run [[plug:test.cmd]]",
            fingerprint: "test-rule",
          },
        ],
      };

      const hash1 = computePreResolutionHash(align);
      const hash2 = computePreResolutionHash(align);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("produces same hash regardless of fill values", () => {
      const align1: Align = {
        id: "test/align",
        version: "1.0.0",
        spec_version: "1",
        plugs: {
          slots: {
            "test.cmd": {
              description: "Test command",
              format: "command",
              required: true,
            },
          },
          fills: {
            "test.cmd": "npm test",
          },
        },
        sections: [
          {
            heading: "Test Rule",
            level: 2,
            content: "Run [[plug:test.cmd]]",
            fingerprint: "test-rule",
          },
        ],
      };

      const align2: Align = {
        ...align1,
        plugs: {
          ...align1.plugs,
          fills: {
            "test.cmd": "pnpm test", // Different fill value
          },
        },
      };

      const hash1 = computePreResolutionHash(align1);
      const hash2 = computePreResolutionHash(align2);

      // Pre-resolution hash should be the same because template is the same
      expect(hash1).toBe(hash2);
    });
  });

  describe("computePostResolutionHash", () => {
    it("produces hash after resolution", () => {
      const align: Align = {
        id: "test/align",
        version: "1.0.0",
        spec_version: "1",
        plugs: {
          slots: {
            "test.cmd": {
              description: "Test command",
              format: "command",
              required: true,
            },
          },
          fills: {
            "test.cmd": "npm test",
          },
        },
        sections: [
          {
            heading: "Test Rule",
            level: 2,
            content: "Run [[plug:test.cmd]]",
            fingerprint: "test-rule",
          },
        ],
      };

      const hash = computePostResolutionHash(align);

      expect(hash).toBeDefined();
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("produces different hash for different fill values", () => {
      const align1: Align = {
        id: "test/align",
        version: "1.0.0",
        spec_version: "1",
        plugs: {
          slots: {
            "test.cmd": {
              description: "Test command",
              format: "command",
              required: true,
            },
          },
          fills: {
            "test.cmd": "npm test",
          },
        },
        sections: [
          {
            heading: "Test Rule",
            level: 2,
            content: "Run [[plug:test.cmd]]",
            fingerprint: "test-rule",
          },
        ],
      };

      // Create align2 with different fill value (deep copy to avoid reference issues)
      const align2: Align = cloneDeep(align1);
      align2.plugs!.fills!["test.cmd"] = "pnpm test";

      const hash1 = computePostResolutionHash(align1);
      const hash2 = computePostResolutionHash(align2);

      // Post-resolution hash should be different because resolved text differs
      expect(hash1).not.toBe(hash2);
    });

    it("returns undefined if resolution fails", () => {
      const align: Align = {
        id: "test/align",
        version: "1.0.0",
        spec_version: "1",
        plugs: {
          slots: {
            "test.cmd": {
              description: "Test command",
              format: "file",
              required: true,
            },
          },
          fills: {
            "test.cmd": "/absolute/path", // Invalid for file format
          },
        },
        sections: [
          {
            heading: "Test Rule",
            level: 2,
            content: "Check [[plug:test.cmd]]",
            fingerprint: "test-rule",
          },
        ],
      };

      const hash = computePostResolutionHash(align);

      expect(hash).toBeUndefined();
    });
  });

  describe("computeDualHash", () => {
    it("computes both pre and post resolution hashes", () => {
      const align: Align = {
        id: "test/align",
        version: "1.0.0",
        spec_version: "1",
        plugs: {
          slots: {
            "test.cmd": {
              description: "Test command",
              format: "command",
              required: true,
            },
          },
          fills: {
            "test.cmd": "npm test",
          },
        },
        sections: [
          {
            heading: "Test Rule",
            level: 2,
            content: "Run [[plug:test.cmd]]",
            fingerprint: "test-rule",
          },
        ],
      };

      const result = computeDualHash(align);

      expect(result.preResolutionHash).toBeDefined();
      expect(result.preResolutionHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.postResolutionHash).toBeDefined();
      expect(result.postResolutionHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.unresolvedRequired).toHaveLength(0);
    });

    it("tracks unresolved required plugs", () => {
      const align: Align = {
        id: "test/align",
        version: "1.0.0",
        spec_version: "1",
        plugs: {
          slots: {
            "test.cmd": {
              description: "Test command",
              format: "command",
              required: true,
            },
            "build.cmd": {
              description: "Build command",
              format: "command",
              required: true,
            },
          },
        },
        sections: [
          {
            heading: "Test Rule",
            level: 2,
            content: "Run [[plug:test.cmd]] then [[plug:build.cmd]]",
            fingerprint: "test-rule",
          },
        ],
      };

      const result = computeDualHash(align);

      expect(result.unresolvedRequired).toContain("test.cmd");
      expect(result.unresolvedRequired).toContain("build.cmd");
      expect(result.unresolvedRequired).toHaveLength(2);
    });
  });
});
