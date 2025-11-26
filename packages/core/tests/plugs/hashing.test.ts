import { describe, it, expect } from "vitest";
import {
  computePreResolutionHash,
  computePostResolutionHash,
  computeDualHash,
} from "../../src/plugs/hashing.js";
import type { AlignPack } from "@aligntrue/schema";
import { cloneDeep } from "@aligntrue/schema";

describe("plugs hashing", () => {
  describe("computePreResolutionHash", () => {
    it("produces deterministic hash for pack with plugs", () => {
      const pack: AlignPack = {
        id: "test/pack",
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

      const hash1 = computePreResolutionHash(pack);
      const hash2 = computePreResolutionHash(pack);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("produces same hash regardless of fill values", () => {
      const pack1: AlignPack = {
        id: "test/pack",
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

      const pack2: AlignPack = {
        ...pack1,
        plugs: {
          ...pack1.plugs,
          fills: {
            "test.cmd": "pnpm test", // Different fill value
          },
        },
      };

      const hash1 = computePreResolutionHash(pack1);
      const hash2 = computePreResolutionHash(pack2);

      // Pre-resolution hash should be the same because template is the same
      expect(hash1).toBe(hash2);
    });
  });

  describe("computePostResolutionHash", () => {
    it("produces hash after resolution", () => {
      const pack: AlignPack = {
        id: "test/pack",
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

      const hash = computePostResolutionHash(pack);

      expect(hash).toBeDefined();
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("produces different hash for different fill values", () => {
      const pack1: AlignPack = {
        id: "test/pack",
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

      // Create pack2 with different fill value (deep copy to avoid reference issues)
      const pack2: AlignPack = cloneDeep(pack1);
      pack2.plugs!.fills!["test.cmd"] = "pnpm test";

      const hash1 = computePostResolutionHash(pack1);
      const hash2 = computePostResolutionHash(pack2);

      // Post-resolution hash should be different because resolved text differs
      expect(hash1).not.toBe(hash2);
    });

    it("returns undefined if resolution fails", () => {
      const pack: AlignPack = {
        id: "test/pack",
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

      const hash = computePostResolutionHash(pack);

      expect(hash).toBeUndefined();
    });
  });

  describe("computeDualHash", () => {
    it("computes both pre and post resolution hashes", () => {
      const pack: AlignPack = {
        id: "test/pack",
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

      const result = computeDualHash(pack);

      expect(result.preResolutionHash).toBeDefined();
      expect(result.preResolutionHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.postResolutionHash).toBeDefined();
      expect(result.postResolutionHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.unresolvedRequired).toHaveLength(0);
    });

    it("tracks unresolved required plugs", () => {
      const pack: AlignPack = {
        id: "test/pack",
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

      const result = computeDualHash(pack);

      expect(result.unresolvedRequired).toContain("test.cmd");
      expect(result.unresolvedRequired).toContain("build.cmd");
      expect(result.unresolvedRequired).toHaveLength(2);
    });
  });
});
