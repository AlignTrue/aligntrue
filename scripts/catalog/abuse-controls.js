/**
 * Abuse control checks for catalog build pipeline (Phase 4)
 *
 * Enforces size limits and prevents binary smuggling to keep
 * catalog safe and performant.
 */
import { statSync, readdirSync } from "fs";
import { join } from "path";
/**
 * Abuse control limits
 */
export const LIMITS = {
  /** Max size for pack YAML (1MB - realistic for ~5,000 rules) */
  MAX_PACK_SIZE: 1 * 1024 * 1024,
  /** Max size for single exporter preview (512KB - realistic for ~2,500 rules) */
  MAX_PREVIEW_SIZE: 512 * 1024,
  /** Max total catalog size (500MB - supports 200-500 packs, revisit at 150 packs) */
  MAX_CATALOG_SIZE: 500 * 1024 * 1024,
  /** Warning threshold for catalog size (50% of max) */
  CATALOG_WARNING_THRESHOLD: 0.5,
};
/**
 * Check if file is likely binary (heuristic check)
 *
 * Reads first 8KB and checks for null bytes and non-printable characters.
 * Not perfect but catches common binaries (images, executables, archives).
 *
 * @param filePath - Path to file
 * @returns True if likely binary
 */
export function isLikelyBinary(filePath) {
  try {
    const stats = statSync(filePath);
    if (stats.size === 0) {
      return false; // Empty file is not binary
    }
    // Read first 8KB or whole file if smaller
    const sampleSize = Math.min(8192, stats.size);
    const buffer = Buffer.alloc(sampleSize);
    const fd = require("fs").openSync(filePath, "r");
    const bytesRead = require("fs").readSync(fd, buffer, 0, sampleSize, 0);
    require("fs").closeSync(fd);
    // Check for null bytes (strong binary indicator)
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) {
        return true;
      }
    }
    // Count non-printable characters (excluding common whitespace)
    let nonPrintable = 0;
    for (let i = 0; i < bytesRead; i++) {
      const byte = buffer[i];
      // Allow: TAB(9), LF(10), CR(13), printable ASCII(32-126)
      if (
        byte !== 9 &&
        byte !== 10 &&
        byte !== 13 &&
        (byte < 32 || byte > 126)
      ) {
        nonPrintable++;
      }
    }
    // If >30% non-printable, likely binary
    const nonPrintableRatio = nonPrintable / bytesRead;
    return nonPrintableRatio > 0.3;
  } catch (err) {
    // If we can't read the file, assume it's safe (will fail elsewhere)
    return false;
  }
}
/**
 * Check pack size limit
 *
 * @param packPath - Path to pack YAML file
 * @returns Violation if pack exceeds limit
 */
export function checkPackSize(packPath) {
  try {
    const stats = statSync(packPath);
    if (stats.size > LIMITS.MAX_PACK_SIZE) {
      return {
        type: "size",
        message: `Pack exceeds size limit: ${(stats.size / 1024 / 1024).toFixed(2)}MB > ${(LIMITS.MAX_PACK_SIZE / 1024 / 1024).toFixed(0)}MB`,
        path: packPath,
        actual: stats.size,
        limit: LIMITS.MAX_PACK_SIZE,
      };
    }
    return null;
  } catch (err) {
    // File doesn't exist or can't be read - will fail elsewhere
    return null;
  }
}
/**
 * Check preview size limit
 *
 * @param previewContent - Preview text content
 * @param format - Exporter format name
 * @returns Violation if preview exceeds limit
 */
export function checkPreviewSize(previewContent, format) {
  const size = Buffer.byteLength(previewContent, "utf8");
  if (size > LIMITS.MAX_PREVIEW_SIZE) {
    return {
      type: "size",
      message: `Preview exceeds size limit: ${format} ${(size / 1024 / 1024).toFixed(2)}MB > ${(LIMITS.MAX_PREVIEW_SIZE / 1024 / 1024).toFixed(0)}MB`,
      actual: size,
      limit: LIMITS.MAX_PREVIEW_SIZE,
    };
  }
  return null;
}
/**
 * Scan directory for binary files
 *
 * @param dirPath - Directory to scan
 * @param exclude - Patterns to exclude (glob-like)
 * @returns Violations for each binary found
 */
export function scanForBinaries(
  dirPath,
  exclude = [".git", "node_modules", ".cache"],
) {
  const violations = [];
  function scan(dir) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        // Skip excluded patterns
        if (exclude.some((pattern) => fullPath.includes(pattern))) {
          continue;
        }
        if (entry.isDirectory()) {
          scan(fullPath);
        } else if (entry.isFile()) {
          // Skip known text extensions
          const textExtensions = [
            ".md",
            ".yaml",
            ".yml",
            ".txt",
            ".json",
            ".js",
            ".ts",
            ".mdc",
          ];
          const hasTextExt = textExtensions.some((ext) =>
            entry.name.endsWith(ext),
          );
          if (!hasTextExt && isLikelyBinary(fullPath)) {
            violations.push({
              type: "binary",
              message: `Binary file detected: ${fullPath}`,
              path: fullPath,
            });
          }
        }
      }
    } catch (err) {
      // Skip directories we can't read
    }
  }
  scan(dirPath);
  return violations;
}
/**
 * Check total catalog size budget
 *
 * @param catalogDir - Path to catalog output directory
 * @returns Violation if total size exceeds budget
 */
export function checkCatalogBudget(catalogDir) {
  const result = checkCatalogSize(catalogDir);
  return result.violation || null;
}
/**
 * Check catalog size with warning threshold
 *
 * Returns detailed size information including warning when
 * catalog exceeds 50% of budget (early warning system).
 *
 * @param catalogDir - Path to catalog output directory
 * @returns Size result with optional violation and warning
 */
export function checkCatalogSize(catalogDir) {
  let totalSize = 0;
  function calculateSize(dir) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          calculateSize(fullPath);
        } else if (entry.isFile()) {
          const stats = statSync(fullPath);
          totalSize += stats.size;
        }
      }
    } catch (err) {
      // Skip directories we can't read
    }
  }
  calculateSize(catalogDir);
  const percentUsed = totalSize / LIMITS.MAX_CATALOG_SIZE;
  const result = {
    totalSize,
    percentUsed,
  };
  // Hard limit violation
  if (totalSize > LIMITS.MAX_CATALOG_SIZE) {
    result.violation = {
      type: "budget",
      message: `Catalog exceeds total size budget: ${(totalSize / 1024 / 1024).toFixed(2)}MB > ${(LIMITS.MAX_CATALOG_SIZE / 1024 / 1024).toFixed(0)}MB`,
      actual: totalSize,
      limit: LIMITS.MAX_CATALOG_SIZE,
    };
  }
  // Warning threshold (50%)
  else if (percentUsed >= LIMITS.CATALOG_WARNING_THRESHOLD) {
    const warningThresholdMB =
      (LIMITS.MAX_CATALOG_SIZE * LIMITS.CATALOG_WARNING_THRESHOLD) /
      1024 /
      1024;
    result.warning = `Catalog size exceeds ${(LIMITS.CATALOG_WARNING_THRESHOLD * 100).toFixed(0)}% threshold: ${(totalSize / 1024 / 1024).toFixed(2)}MB > ${warningThresholdMB.toFixed(0)}MB (${(percentUsed * 100).toFixed(1)}% used). Consider increasing catalog budget or removing old packs.`;
  }
  return result;
}
/**
 * Run all abuse controls for a pack
 *
 * @param packPath - Path to pack YAML
 * @param packDir - Pack directory to scan for binaries
 * @returns All violations found
 */
export function runPackAbuseControls(packPath, packDir) {
  const violations = [];
  // Check pack size
  const sizeViolation = checkPackSize(packPath);
  if (sizeViolation) {
    violations.push(sizeViolation);
  }
  // Scan for binaries if packDir provided
  if (packDir) {
    const binaryViolations = scanForBinaries(packDir);
    violations.push(...binaryViolations);
  }
  return violations;
}
