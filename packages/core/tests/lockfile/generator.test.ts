import { describe, it, expect } from "vitest";
import type { Align, AlignSection } from "@aligntrue/schema";
import { generateLockfile } from "../../src/lockfile/generator.js";

const baseSection: AlignSection = {
  heading: "Sample Rule",
  level: 2,
  content: "Follow the guideline",
  fingerprint: "rule.sample",
};

const baseAlign: Align = {
  id: "bundle.test",
  version: "1.0.0",
  spec_version: "1",
  sections: [baseSection],
};

describe("lockfile generator hashing", () => {
  it("captures non-volatile vendor metadata", () => {
    const alignWithTimestamp: Align = {
      ...baseAlign,
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

    const alignWithNewTimestamp: Align = {
      ...baseAlign,
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

    const lockfileA = generateLockfile(alignWithTimestamp, "team");
    const lockfileB = generateLockfile(alignWithNewTimestamp, "team");

    expect(lockfileA.rules[0].content_hash).not.toBe(
      lockfileB.rules[0].content_hash,
    );
  });

  it("ignores vendor volatile fields", () => {
    const alignWithVolatile: Align = {
      ...baseAlign,
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

    const alignWithUpdatedVolatile: Align = {
      ...baseAlign,
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

    const lockfileA = generateLockfile(alignWithVolatile, "team");
    const lockfileB = generateLockfile(alignWithUpdatedVolatile, "team");

    expect(lockfileA.rules[0].content_hash).toBe(
      lockfileB.rules[0].content_hash,
    );
  });
});
