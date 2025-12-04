/**
 * Drift log for tracking new file detections
 * Used by watch mode to persist pending imports across sessions
 *
 * PERSISTENCE:
 * - Stored at .aligntrue/.drift-log.json
 * - Created when watch mode detects NEW untracked files with content
 * - Persists state (pending_review, imported, ignored) between sessions
 * - Used by sync command to prompt for import of previously detected files
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { ensureDirectoryExists } from "@aligntrue/file-utils";

/**
 * Status of a detected file
 */
export type DriftStatus = "pending_review" | "imported" | "ignored";

/**
 * Drift detection entry
 */
export interface DriftDetection {
  timestamp: string;
  file: string;
  sections: number;
  status: DriftStatus;
}

/**
 * Drift log structure
 */
export interface DriftLog {
  detections: DriftDetection[];
}

/**
 * Get path to drift log file
 */
function getDriftLogPath(cwd: string): string {
  return join(cwd, ".aligntrue", ".drift-log.json");
}

/**
 * Load drift log from filesystem
 * Returns empty log if file doesn't exist
 */
export function loadDriftLog(cwd: string): DriftLog {
  const logPath = getDriftLogPath(cwd);

  if (!existsSync(logPath)) {
    return { detections: [] };
  }

  try {
    const content = readFileSync(logPath, "utf-8");
    const log = JSON.parse(content) as DriftLog;
    return log;
  } catch {
    // If file is corrupted, return empty log
    return { detections: [] };
  }
}

/**
 * Save drift log to filesystem
 */
export function saveDriftLog(cwd: string, log: DriftLog): void {
  const logPath = getDriftLogPath(cwd);

  // Ensure .aligntrue directory exists
  const dir = dirname(logPath);
  ensureDirectoryExists(dir);

  writeFileSync(logPath, JSON.stringify(log, null, 2), "utf-8");
}

/**
 * Update status of a detected file
 */
export function updateDriftStatus(
  cwd: string,
  file: string,
  status: DriftStatus,
): void {
  const log = loadDriftLog(cwd);

  const detection = log.detections.find((d) => d.file === file);
  if (detection) {
    detection.status = status;
    detection.timestamp = new Date().toISOString();
    saveDriftLog(cwd, log);
  }
}

/**
 * Get pending detections (files waiting for review)
 */
export function getPendingDetections(cwd: string): DriftDetection[] {
  const log = loadDriftLog(cwd);
  return log.detections.filter((d) => d.status === "pending_review");
}

/**
 * Clear all detections with a specific status
 */
export function clearDetectionsByStatus(
  cwd: string,
  status: DriftStatus,
): void {
  const log = loadDriftLog(cwd);
  log.detections = log.detections.filter((d) => d.status !== status);
  saveDriftLog(cwd, log);
}

/**
 * Clear all detections
 */
export function clearAllDetections(cwd: string): void {
  saveDriftLog(cwd, { detections: [] });
}
