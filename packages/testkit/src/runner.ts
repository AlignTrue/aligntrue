/**
 * Testkit runner for conformance testing
 */
import {
  canonicalizeJson,
  computeHash,
  parseYamlToJson,
  validateAlign,
} from "@aligntrue/schema";
import type {
  CanonVector,
  CheckVector,
  VectorResults,
  VectorFailure,
} from "./types.js";

/**
 * Canonicalization implementation interface
 */
export interface CanonImpl {
  canonicalize: (input: unknown) => string;
  hash: (data: string) => string;
}

/**
 * Run canonicalization vectors against an implementation
 */
export function runCanonVectors(
  vectors: CanonVector[],
  impl: CanonImpl,
): VectorResults {
  const failures: VectorFailure[] = [];

  for (const vector of vectors) {
    try {
      const actualJcs = impl.canonicalize(vector.input);
      const actualHash = impl.hash(actualJcs);

      if (actualJcs !== vector.expected_jcs) {
        failures.push({
          vector_name: vector.name,
          reason: "JCS output mismatch",
          expected: vector.expected_jcs,
          actual: actualJcs,
        });
      }

      if (actualHash !== vector.expected_sha256) {
        failures.push({
          vector_name: vector.name,
          reason: "SHA-256 hash mismatch",
          expected: vector.expected_sha256,
          actual: actualHash,
        });
      }
    } catch (error) {
      failures.push({
        vector_name: vector.name,
        reason: `Exception: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  return {
    total: vectors.length,
    passed: vectors.length - failures.length,
    failed: failures.length,
    failures,
  };
}

/**
 * Check runner implementation interface
 */
export interface CheckImpl {
  runCheck: (rule: unknown, context: unknown) => Promise<unknown>;
}

/**
 * Run check vectors against an implementation
 *
 * Note: This is a simplified runner. Full implementation would require
 * FileProvider abstraction and proper context setup.
 */
export function runCheckVectors(
  vectors: CheckVector[],
  _impl: CheckImpl,
): VectorResults {
  const failures: VectorFailure[] = [];

  // For now, we just validate the vector structure
  for (const vector of vectors) {
    try {
      if (!vector.rule.id || !vector.rule.check) {
        failures.push({
          vector_name: vector.name,
          reason: "Invalid rule structure",
        });
      }

      if (typeof vector.file_tree !== "object") {
        failures.push({
          vector_name: vector.name,
          reason: "Invalid file_tree structure",
        });
      }

      if (!Array.isArray(vector.expected_findings)) {
        failures.push({
          vector_name: vector.name,
          reason: "Invalid expected_findings structure",
        });
      }
    } catch (error) {
      failures.push({
        vector_name: vector.name,
        reason: `Exception: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  return {
    total: vectors.length,
    passed: vectors.length - failures.length,
    failed: failures.length,
    failures,
  };
}

/**
 * Pack validator implementation interface
 */
export interface PackValidator {
  validatePack: (yaml: string) => {
    valid: boolean;
    hash?: string;
    errors?: string[];
  };
}

/**
 * Run validation on golden packs
 */
export function runGoldenPacks(
  packFiles: Map<string, string>,
  validator: PackValidator,
): VectorResults {
  const failures: VectorFailure[] = [];
  const total = packFiles.size;

  for (const [filename, content] of packFiles) {
    try {
      const result = validator.validatePack(content);

      if (!result.valid) {
        failures.push({
          vector_name: filename,
          reason: `Validation failed: ${result.errors?.join(", ") || "unknown error"}`,
        });
      }

      // Verify hash matches what's in the file
      const parsed = parseYamlToJson(content) as any;
      if (
        parsed.integrity?.value &&
        result.hash &&
        parsed.integrity.value !== result.hash
      ) {
        failures.push({
          vector_name: filename,
          reason: "Hash mismatch",
          expected: parsed.integrity.value,
          actual: result.hash,
        });
      }
    } catch (error) {
      failures.push({
        vector_name: filename,
        reason: `Exception: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  return {
    total,
    passed: total - failures.length,
    failed: failures.length,
    failures,
  };
}

/**
 * Run all conformance vectors
 *
 * This is a convenience function that runs canonicalization, check, and golden pack vectors
 * using the AlignTrue reference implementation.
 */
export function runAllVectors(
  canonVectors: CanonVector[],
  checkVectors: CheckVector[],
  goldenPacks: Map<string, string>,
): {
  canonicalization: VectorResults;
  checks: VectorResults;
  golden: VectorResults;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
} {
  // Use AlignTrue implementation as reference
  const canonImpl: CanonImpl = {
    canonicalize: canonicalizeJson,
    hash: computeHash,
  };

  const checkImpl: CheckImpl = {
    runCheck: async () => ({ pass: true, findings: [] }),
  };

  const packValidator: PackValidator = {
    validatePack: (yaml: string) => {
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
      } catch (error) {
        return {
          valid: false,
          errors: [error instanceof Error ? error.message : String(error)],
        };
      }
    },
  };

  const canonResults = runCanonVectors(canonVectors, canonImpl);
  const checkResults = runCheckVectors(checkVectors, checkImpl);
  const goldenResults = runGoldenPacks(goldenPacks, packValidator);

  return {
    canonicalization: canonResults,
    checks: checkResults,
    golden: goldenResults,
    summary: {
      total: canonResults.total + checkResults.total + goldenResults.total,
      passed: canonResults.passed + checkResults.passed + goldenResults.passed,
      failed: canonResults.failed + checkResults.failed + goldenResults.failed,
    },
  };
}
