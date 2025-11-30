#!/usr/bin/env node
/**
 * Clean up orphaned AlignTrue test directories from /tmp
 *
 * Usage:
 *   node scripts/cleanup-test-temps.mjs           # Dry run (list only)
 *   node scripts/cleanup-test-temps.mjs --delete  # Actually delete
 *   pnpm cleanup:temps                            # Via package.json script
 */

import { readdirSync, statSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir, platform } from "os";

/**
 * Patterns that match AlignTrue test directories
 * These are created by various test suites and manual exploratory testing
 */
const ALIGNTRUE_TEMP_PATTERNS = [
  /^aligntrue-/, // All aligntrue-* prefixed dirs (tests, backups, perf, etc.)
  /^test-/, // Common test- prefix from exploratory testing
  /^ruler-/, // ruler-* tests
  /^solo-test/, // Solo workflow tests
  /^team-/, // Team tests
  /^exploratory-/, // Exploratory testing
  /^split-test/, // Split tests
];

/**
 * Check if a directory name matches any AlignTrue test pattern
 */
function isAlignTrueTestDir(name) {
  return ALIGNTRUE_TEMP_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Format bytes into human-readable size
 */
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Format milliseconds into human-readable age
 */
function formatAge(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

/**
 * Get directory size recursively (approximate, for display)
 */
function getDirSize(dirPath) {
  let size = 0;
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          size += getDirSize(entryPath);
        } else {
          size += statSync(entryPath).size;
        }
      } catch {
        // Ignore unreadable entries
      }
    }
  } catch {
    // Ignore unreadable directories
  }
  return size;
}

/**
 * Get list of temp directories to scan
 * On macOS, check both os.tmpdir() (per-user) and /private/tmp (system-wide)
 */
function getTempDirectories() {
  const dirs = [tmpdir()];

  // On macOS, also check /private/tmp (symlinked from /tmp)
  // Shell scripts and some tools write there instead of the per-user temp
  if (platform() === "darwin") {
    const systemTmp = "/private/tmp";
    if (existsSync(systemTmp) && !dirs.includes(systemTmp)) {
      dirs.push(systemTmp);
    }
  }

  return dirs;
}

function main() {
  const args = process.argv.slice(2);
  const shouldDelete = args.includes("--delete") || args.includes("-d");
  const verbose = args.includes("--verbose") || args.includes("-v");

  const tmpDirs = getTempDirectories();
  console.log(
    `Scanning ${tmpDirs.length} temp director${tmpDirs.length === 1 ? "y" : "ies"} for AlignTrue test directories...\n`,
  );

  const testDirs = [];

  for (const tmpDir of tmpDirs) {
    if (verbose) {
      console.log(`  Checking: ${tmpDir}`);
    }

    let entries;
    try {
      entries = readdirSync(tmpDir);
    } catch (err) {
      console.error(`  Cannot read ${tmpDir}: ${err.message}`);
      continue;
    }

    for (const name of entries) {
      if (!isAlignTrueTestDir(name)) continue;

      const path = join(tmpDir, name);
      try {
        const stats = statSync(path);
        if (!stats.isDirectory()) continue;
        testDirs.push({
          path,
          name,
          source: tmpDir,
          mtime: stats.mtimeMs,
          age: Date.now() - stats.mtimeMs,
          size: verbose ? getDirSize(path) : 0,
        });
      } catch {
        // Skip unreadable entries
      }
    }
  }

  if (verbose) {
    console.log("");
  }

  // Sort by age (oldest first)
  testDirs.sort((a, b) => b.age - a.age);

  if (testDirs.length === 0) {
    console.log("No AlignTrue test directories found.");
    return;
  }

  console.log(
    `Found ${testDirs.length} test director${testDirs.length === 1 ? "y" : "ies"}:\n`,
  );

  let totalSize = 0;
  for (const dir of testDirs) {
    const ageStr = formatAge(dir.age);
    if (verbose) {
      const sizeStr = formatBytes(dir.size);
      totalSize += dir.size;
      console.log(`  ${dir.name}  (${ageStr}, ${sizeStr})`);
    } else {
      console.log(`  ${dir.name}  (${ageStr})`);
    }
  }

  if (verbose && totalSize > 0) {
    console.log(`\nTotal size: ${formatBytes(totalSize)}`);
  }

  if (!shouldDelete) {
    console.log(
      `\nDry run. Use --delete to actually remove these directories.`,
    );
    console.log(`Example: node scripts/cleanup-test-temps.mjs --delete`);
    return;
  }

  console.log(`\nDeleting ${testDirs.length} directories...`);
  let deleted = 0;
  let errors = 0;

  for (const dir of testDirs) {
    try {
      rmSync(dir.path, { recursive: true, force: true });
      deleted++;
      if (verbose) {
        console.log(`  Deleted: ${dir.name}`);
      }
    } catch (err) {
      errors++;
      console.error(`  Failed to delete ${dir.name}: ${err.message}`);
    }
  }

  console.log(`\nDeleted ${deleted} director${deleted === 1 ? "y" : "ies"}.`);
  if (errors > 0) {
    console.log(
      `Failed to delete ${errors} director${errors === 1 ? "y" : "ies"}.`,
    );
    process.exit(1);
  }
}

main();
