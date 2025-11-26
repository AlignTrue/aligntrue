/**
 * Conformance tests - validates AlignTrue implementation against test vectors
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { runCanonVectors, runGoldenAligns } from "../src/runner.js";
import {
  canonicalizeJson,
  computeHash,
  parseYamlToJson,
  validateAlign,
} from "@aligntrue/schema";
import type { CanonVector, AlignValidator } from "../src/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const vectorsDir = join(__dirname, "../vectors");
const goldenDir = join(__dirname, "../golden");

describe("Conformance: Canonicalization", () => {
  const canonVectors: CanonVector[] = JSON.parse(
    readFileSync(join(vectorsDir, "canonicalization.json"), "utf-8"),
  );

  const impl = {
    canonicalize: canonicalizeJson,
    hash: computeHash,
  };

  it("passes all canonicalization vectors", () => {
    const results = runCanonVectors(canonVectors, impl);

    if (results.failed > 0) {
      console.error("Canonicalization failures:", results.failures);
    }

    expect(results.failures).toHaveLength(0);
    expect(results.passed).toBe(results.total);
  });

  it("handles each canonicalization vector individually", () => {
    for (const vector of canonVectors) {
      const results = runCanonVectors([vector], impl);
      expect(results.passed).toBe(1);
    }
  });
});

describe("Conformance: Check Vectors", () => {
  const checkTypes = [
    "file-presence",
    "path-convention",
    "manifest-policy",
    "regex",
    "command-runner",
  ];

  for (const checkType of checkTypes) {
    it(`validates ${checkType} vectors`, () => {
      const vectorFile = join(vectorsDir, "checks", `${checkType}.json`);
      const vectors = JSON.parse(readFileSync(vectorFile, "utf-8"));

      expect(Array.isArray(vectors)).toBe(true);
      expect(vectors.length).toBeGreaterThan(0);

      // Verify vector structure
      for (const vector of vectors) {
        expect(vector.name).toBeTruthy();
        expect(vector.description).toBeTruthy();
        expect(vector.check_type).toBe(checkType.replace("-", "_"));
        expect(vector.rule).toBeTruthy();
        expect(vector.file_tree).toBeDefined();
        expect(Array.isArray(vector.expected_findings)).toBe(true);
      }
    });
  }
});

describe("Conformance: Golden Aligns", () => {
  const goldenFiles = readdirSync(goldenDir).filter((f) =>
    f.endsWith(".aligntrue.yaml"),
  );
  const goldenAligns = new Map<string, string>();

  for (const file of goldenFiles) {
    goldenAligns.set(file, readFileSync(join(goldenDir, file), "utf-8"));
  }

  const validator: AlignValidator = {
    validateAlign: (yaml: string) => {
      try {
        const validation = validateAlign(yaml);

        if (!validation.schema.valid) {
          return {
            valid: false,
            errors: validation.schema.errors?.map((e) => e.message) || [
              "Schema validation failed",
            ],
          };
        }

        if (
          !validation.integrity.valid &&
          validation.integrity.storedHash !== "<computed>"
        ) {
          return {
            valid: false,
            errors: [
              validation.integrity.error || "Integrity validation failed",
            ],
          };
        }

        const result: { valid: boolean; hash?: string; errors?: string[] } = {
          valid: true,
        };

        if (validation.integrity.computedHash) {
          result.hash = validation.integrity.computedHash;
        }

        return result;
      } catch {
        return {
          valid: false,
          errors: [error instanceof Error ? error.message : String(error)],
        };
      }
    },
  };

  it("passes all golden align validations", () => {
    const results = runGoldenAligns(goldenAligns, validator);

    if (results.failed > 0) {
      console.error("Golden align failures:", results.failures);
    }

    expect(results.failures).toHaveLength(0);
    expect(results.passed).toBe(results.total);
  });

  it("validates each golden align individually", () => {
    for (const [filename, content] of goldenAligns) {
      const singleAlign = new Map([[filename, content]]);
      const results = runGoldenAligns(singleAlign, validator);

      if (results.failed > 0) {
        console.error(`Golden align ${filename} failed:`, results.failures);
      }

      expect(results.passed).toBe(1);
    }
  });

  it("has exactly 5 golden aligns", () => {
    expect(goldenFiles).toHaveLength(5);
  });

  it("golden aligns have computed integrity hashes", () => {
    for (const [_filename, content] of goldenAligns) {
      const parsed = parseYamlToJson(content) as any;

      expect(parsed.integrity).toBeDefined();
      expect(parsed.integrity.algo).toBe("jcs-sha256");
      expect(parsed.integrity.value).toBeTruthy();
      expect(parsed.integrity.value).not.toBe("<computed>");
      expect(parsed.integrity.value).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});

describe("Conformance: Summary", () => {
  it("reports total vector counts", () => {
    const canonVectors: CanonVector[] = JSON.parse(
      readFileSync(join(vectorsDir, "canonicalization.json"), "utf-8"),
    );

    const checkTypes = [
      "file-presence",
      "path-convention",
      "manifest-policy",
      "regex",
      "command-runner",
    ];
    let checkVectorCount = 0;
    for (const checkType of checkTypes) {
      const vectors = JSON.parse(
        readFileSync(join(vectorsDir, "checks", `${checkType}.json`), "utf-8"),
      );
      checkVectorCount += vectors.length;
    }

    const goldenFiles = readdirSync(goldenDir).filter((f) =>
      f.endsWith(".aligntrue.yaml"),
    );

    console.log("\nConformance Testkit Summary:");
    console.log(`  Canonicalization vectors: ${canonVectors.length}`);
    console.log(`  Check runner vectors: ${checkVectorCount}`);
    console.log(`  Golden aligns: ${goldenFiles.length}`);
    console.log(
      `  Total: ${canonVectors.length + checkVectorCount + goldenFiles.length}`,
    );

    expect(canonVectors.length).toBeGreaterThanOrEqual(15);
    expect(checkVectorCount).toBeGreaterThanOrEqual(12);
    expect(goldenFiles.length).toBe(5);
  });
});
