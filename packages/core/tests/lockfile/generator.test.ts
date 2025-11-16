import { describe, it, expect } from "vitest";
import type { AlignPack, AlignSection } from "@aligntrue/schema";
import { generateLockfile } from "../../src/lockfile/generator.js";

const baseSection: AlignSection = {
  heading: "Sample Rule",
  level: 2,
  content: "Follow the guideline",
  fingerprint: "rule.sample",
};

const basePack: AlignPack = {
  id: "bundle.test",
  version: "1.0.0",
  spec_version: "1",
  sections: [baseSection],
};

describe("lockfile generator hashing", () => {
  it("captures non-volatile vendor metadata", () => {
    const packWithTimestamp: AlignPack = {
      ...basePack,
      sections: [
        {
          ...baseSection,
          vendor: {
            aligntrue: {
              last_modified: "2025-01-01T00:00:00.000Z",
            },
          },
        },
      ],
    };

    const packWithNewTimestamp: AlignPack = {
      ...basePack,
      sections: [
        {
          ...baseSection,
          vendor: {
            aligntrue: {
              last_modified: "2025-01-02T00:00:00.000Z",
            },
          },
        },
      ],
    };

    const lockfileA = generateLockfile(packWithTimestamp, "team");
    const lockfileB = generateLockfile(packWithNewTimestamp, "team");

    expect(lockfileA.rules[0].content_hash).not.toBe(
      lockfileB.rules[0].content_hash,
    );
  });

  it("ignores vendor volatile fields", () => {
    const packWithVolatile: AlignPack = {
      ...basePack,
      sections: [
        {
          ...baseSection,
          vendor: {
            _meta: {
              volatile: ["aligntrue.detection_run"],
            },
            aligntrue: {
              detection_run: "first",
            },
          },
        },
      ],
    };

    const packWithUpdatedVolatile: AlignPack = {
      ...basePack,
      sections: [
        {
          ...baseSection,
          vendor: {
            _meta: {
              volatile: ["aligntrue.detection_run"],
            },
            aligntrue: {
              detection_run: "second",
            },
          },
        },
      ],
    };

    const lockfileA = generateLockfile(packWithVolatile, "team");
    const lockfileB = generateLockfile(packWithUpdatedVolatile, "team");

    expect(lockfileA.rules[0].content_hash).toBe(
      lockfileB.rules[0].content_hash,
    );
  });
});
