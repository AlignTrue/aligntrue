#!/usr/bin/env node
/**
 * Report generator for comprehensive tests
 * Reads test logs and generates formatted reports
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const logsDir = process.argv[2] || ".internal_docs";

if (!existsSync(logsDir)) {
  console.error(`Logs directory not found: ${logsDir}`);
  process.exit(1);
}

console.log(`\n=== Test Report Generator ===`);
console.log(`Reading logs from: ${logsDir}\n`);

// Find all test log files
const files = readdirSync(logsDir).filter(
  (f) => f.startsWith("test-layer-") && f.endsWith(".log"),
);

if (files.length === 0) {
  console.log("No test logs found");
  process.exit(0);
}

console.log(`Found ${files.length} test log(s):\n`);

interface TestSummary {
  layer: number;
  timestamp: string;
  passed: number;
  failed: number;
  total: number;
  issues: string[];
}

const summaries: TestSummary[] = [];

for (const file of files) {
  const filePath = join(logsDir, file);
  const content = readFileSync(filePath, "utf-8");

  // Extract layer number from filename
  const layerMatch = file.match(/test-layer-(\d+)-/);
  if (!layerMatch) continue;

  const layer = parseInt(layerMatch[1], 10);

  // Parse log content
  const passMatches = content.match(/✓ PASS/g);
  const failMatches = content.match(/✗ FAIL/g);
  const passed = passMatches ? passMatches.length : 0;
  const failed = failMatches ? failMatches.length : 0;

  // Extract timestamp from filename
  const timestampMatch = file.match(/-(\d+)\.log$/);
  const timestamp = timestampMatch
    ? new Date(parseInt(timestampMatch[1], 10)).toISOString()
    : "unknown";

  // Extract issues
  const issues: string[] = [];
  const issueMatches = content.matchAll(/✗ FAIL: (.+)/g);
  for (const match of issueMatches) {
    issues.push(match[1]);
  }

  summaries.push({
    layer,
    timestamp,
    passed,
    failed,
    total: passed + failed,
    issues,
  });

  console.log(`Layer ${layer}:`);
  console.log(`  Timestamp: ${new Date(timestamp).toLocaleString()}`);
  console.log(`  Total tests: ${passed + failed}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  if (issues.length > 0) {
    console.log(`  Issues:`);
    for (const issue of issues) {
      console.log(`    - ${issue}`);
    }
  }
  console.log();
}

// Overall summary
const totalPassed = summaries.reduce((sum, s) => sum + s.passed, 0);
const totalFailed = summaries.reduce((sum, s) => sum + s.failed, 0);
const totalTests = totalPassed + totalFailed;

console.log("=".repeat(60));
console.log("OVERALL SUMMARY");
console.log("=".repeat(60));
console.log(`Layers tested: ${summaries.length}`);
console.log(`Total tests: ${totalTests}`);
console.log(`Passed: ${totalPassed}`);
console.log(`Failed: ${totalFailed}`);
console.log(`Success rate: ${Math.round((totalPassed / totalTests) * 100)}%`);

if (totalFailed > 0) {
  console.log(
    `\nTotal issues found: ${summaries.reduce((sum, s) => sum + s.issues.length, 0)}`,
  );
}

process.exit(totalFailed > 0 ? 1 : 0);
