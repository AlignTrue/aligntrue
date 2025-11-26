#!/usr/bin/env tsx
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { computeAlignHash } from "../src/canonicalize.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Compute and update integrity hashes for all basealign files
 *
 * This script:
 * 1. Reads all .yaml files from basealigns/
 * 2. Computes their canonical hash
 * 3. Replaces value: "<computed>" with the actual hash
 * 4. Writes updated files back
 * 5. Prints a summary table
 */

interface AlignHashResult {
  id: string;
  file: string;
  hash: string;
  updated: boolean;
}

function main() {
  // Resolve paths relative to repo root
  const repoRoot = resolve(__dirname, "../../..");
  const basealignsDir = join(repoRoot, "basealigns");

  console.log("Computing hashes for basealigns...");
  console.log(`Reading from: ${basealignsDir}\n`);

  // Get all .yaml files
  const files = readdirSync(basealignsDir).filter((f) => f.endsWith(".yaml"));

  if (files.length === 0) {
    console.log("No .yaml files found in basealigns/");
    return;
  }

  const results: AlignHashResult[] = [];

  // Process each file
  for (const file of files) {
    const filePath = join(basealignsDir, file);
    const content = readFileSync(filePath, "utf8");

    try {
      // Compute hash
      const hash = computeAlignHash(content);

      // Extract align ID from content
      const idMatch = content.match(/^id:\s*["']?(.+?)["']?\s*$/m);
      const alignId = idMatch ? idMatch[1] : file;

      // Check if hash needs to be updated
      const hasPlaceholder = content.includes('value: "<computed>"');

      if (hasPlaceholder) {
        // Replace placeholder with actual hash
        const updatedContent = content.replace(
          /value:\s*["']<computed>["']/,
          `value: "${hash}"`,
        );

        // Write back
        writeFileSync(filePath, updatedContent, "utf8");

        results.push({
          id: alignId,
          file,
          hash,
          updated: true,
        });
      } else {
        results.push({
          id: alignId,
          file,
          hash,
          updated: false,
        });
      }
    } catch {
      console.error(`Error processing ${file}:`, err);
    }
  }

  // Print summary table
  console.log("┌─────────────────────────────────────────┬──────────┐");
  console.log("│ Align ID                                 │ Updated  │");
  console.log("├─────────────────────────────────────────┼──────────┤");

  for (const result of results.sort((a, b) => a.id.localeCompare(b.id))) {
    const idPadded = result.id.padEnd(39);
    const status = result.updated ? "✓ Yes" : "  No";
    console.log(`│ ${idPadded} │ ${status}    │`);
  }

  console.log("└─────────────────────────────────────────┴──────────┘");
  console.log();

  // Print first hash as example
  if (results.length > 0) {
    console.log("Example hash (first align):");
    console.log(`  ${results[0].hash}`);
    console.log();
  }

  const updatedCount = results.filter((r) => r.updated).length;
  console.log(`✓ Processed ${results.length} aligns`);
  console.log(`✓ Updated ${updatedCount} aligns with computed hashes`);

  if (updatedCount > 0) {
    console.log("\nFiles have been updated with integrity hashes.");
    console.log("Review changes and commit when ready.");
  }
}

main();
