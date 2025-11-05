#!/usr/bin/env tsx
import { readFileSync } from "fs";
import { resolve } from "path";
import { validateAlign } from "../src/validator.js";

/**
 * Validate an Align pack file
 *
 * Usage:
 *   pnpm validate path/to/pack.yaml
 *   node --import tsx scripts/validate-align.ts path/to/pack.yaml
 */

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Error: Missing file path argument");
    console.error("");
    console.error("Usage:");
    console.error("  pnpm validate <path-to-align.yaml>");
    console.error("");
    console.error("Example:");
    console.error("  pnpm validate ../../basealigns/testing.yaml");
    process.exit(2);
  }

  const filePath = resolve(args[0]);

  try {
    // Read file
    const content = readFileSync(filePath, "utf8");

    // Validate
    const result = validateAlign(content);

    // Print results
    console.log(`Validating: ${filePath}`);
    console.log("");

    // Schema validation
    console.log("Schema Validation:");
    if (result.schema.valid) {
      console.log("  ✓ PASS");
    } else {
      console.log("  ✗ FAIL");
      console.log("");
      console.log("  Errors:");
      for (const error of result.schema.errors || []) {
        console.log(`    • ${error.path}: ${error.message}`);
        if (error.params && Object.keys(error.params).length > 0) {
          console.log(`      Params: ${JSON.stringify(error.params)}`);
        }
      }
    }

    console.log("");

    // Integrity validation
    console.log("Integrity Validation:");
    if (result.integrity.valid) {
      console.log("  ✓ PASS");
      if (
        result.integrity.storedHash &&
        result.integrity.storedHash !== "<computed>"
      ) {
        console.log(`  Hash: ${result.integrity.storedHash}`);
      } else if (result.integrity.storedHash === "<computed>") {
        console.log("  Note: Using <computed> placeholder (authoring mode)");
      }
    } else {
      console.log("  ✗ FAIL");
      if (result.integrity.error) {
        console.log(`  Error: ${result.integrity.error}`);
      } else {
        console.log(`  Stored:   ${result.integrity.storedHash}`);
        console.log(`  Computed: ${result.integrity.computedHash}`);
        console.log("  Hashes do not match!");
      }
    }

    console.log("");

    // Overall result
    const allValid = result.schema.valid && result.integrity.valid;
    if (allValid) {
      console.log("✓ All validations passed");
      process.exit(0);
    } else {
      console.log("✗ Validation failed");
      process.exit(1);
    }
  } catch {
    console.error("Error:", err instanceof Error ? err.message : String(err));
    process.exit(3);
  }
}

main();
