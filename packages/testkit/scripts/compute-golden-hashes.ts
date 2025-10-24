#!/usr/bin/env tsx
/**
 * Computes integrity hashes for golden packs
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { computeAlignHash } from '@aligntrue/schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const goldenDir = join(__dirname, '../golden');
const files = readdirSync(goldenDir).filter(f => f.endsWith('.aligntrue.yaml'));

console.log(`Computing hashes for ${files.length} golden packs...\n`);

for (const file of files) {
  const path = join(goldenDir, file);
  const content = readFileSync(path, 'utf-8');
  
  try {
    const hash = computeAlignHash(content);
    // Replace any existing hash value (computed or actual hex)
    const updated = content.replace(/value: "(?:<computed>|[a-f0-9]{64})"/, `value: "${hash}"`);
    
    writeFileSync(path, updated, 'utf-8');
    console.log(`✓ ${file}: ${hash}`);
  } catch (error) {
    console.error(`✗ ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log('\nAll golden packs updated.');

