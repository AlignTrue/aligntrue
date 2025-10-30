#!/usr/bin/env tsx
/**
 * Computes actual JCS and SHA-256 hashes for canonicalization vectors
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { canonicalizeJson, computeHash } from "@aligntrue/schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CanonVector {
  name: string;
  description: string;
  input: unknown;
  expected_jcs: string;
  expected_sha256: string;
}

const vectorsPath = join(__dirname, "../vectors/canonicalization.json");
const vectors: CanonVector[] = JSON.parse(readFileSync(vectorsPath, "utf-8"));

console.log("Computing hashes for canonicalization vectors...\n");

const updated = vectors.map((vector) => {
  const jcs = canonicalizeJson(vector.input);
  const sha256 = computeHash(jcs);

  console.log(`${vector.name}:`);
  console.log(`  JCS: ${jcs.substring(0, 60)}${jcs.length > 60 ? "..." : ""}`);
  console.log(`  SHA-256: ${sha256}\n`);

  return {
    ...vector,
    expected_jcs: jcs,
    expected_sha256: sha256,
  };
});

writeFileSync(vectorsPath, JSON.stringify(updated, null, 2) + "\n", "utf-8");
console.log(`✓ Updated ${updated.length} vectors in ${vectorsPath}`);
