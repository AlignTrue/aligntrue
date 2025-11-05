/**
 * Edit detection for conflict resolution
 * Detects when files have been manually modified to prevent auto-pull from overwriting changes
 */

import { statSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export interface EditInfo {
  filePath: string;
  lastModified: number;
  wasModifiedSince: boolean;
}

export interface ConflictInfo {
  irPath: string;
  agentPath: string;
  irModified: number;
  agentModified: number;
  hasConflict: boolean;
  reason?: string;
}

/**
 * Detects manual edits to files to prevent data loss from auto-pull
 */
export class EditDetector {
  private lastSyncFile: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.lastSyncFile = join(workspaceRoot, ".aligntrue", ".last-sync");
  }

  /**
   * Check if a file was modified since the given timestamp
   */
  wasFileModifiedSince(filePath: string, timestamp: number): boolean {
    if (!existsSync(filePath)) {
      return false;
    }

    try {
      const stats = statSync(filePath);
      return stats.mtimeMs > timestamp;
    } catch {
      return false;
    }
  }

  /**
   * Get file modification time
   */
  getFileModificationTime(filePath: string): number | null {
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const stats = statSync(filePath);
      return stats.mtimeMs;
    } catch {
      return null;
    }
  }

  /**
   * Check if there's a conflict between IR and agent files
   * A conflict exists when both files have been modified since last sync
   */
  hasConflict(irPath: string, agentPath: string): ConflictInfo {
    const irModified = this.getFileModificationTime(irPath);
    const agentModified = this.getFileModificationTime(agentPath);
    const lastSync = this.getLastSyncTimestamp();

    if (irModified === null || agentModified === null) {
      return {
        irPath,
        agentPath,
        irModified: irModified || 0,
        agentModified: agentModified || 0,
        hasConflict: false,
        reason:
          irModified === null ? "IR file not found" : "Agent file not found",
      };
    }

    // If we don't have a last sync timestamp, no conflict detection possible
    if (lastSync === null) {
      return {
        irPath,
        agentPath,
        irModified,
        agentModified,
        hasConflict: false,
        reason: "No previous sync timestamp available",
      };
    }

    // Check if both files were modified since last sync
    const irWasModified = irModified > lastSync;
    const agentWasModified = agentModified > lastSync;

    if (irWasModified && agentWasModified) {
      return {
        irPath,
        agentPath,
        irModified,
        agentModified,
        hasConflict: true,
        reason: "Both IR and agent files modified since last sync",
      };
    }

    return {
      irPath,
      agentPath,
      irModified,
      agentModified,
      hasConflict: false,
    };
  }

  /**
   * Get the timestamp of the last sync operation
   */
  getLastSyncTimestamp(): number | null {
    if (!existsSync(this.lastSyncFile)) {
      return null;
    }

    try {
      const content = readFileSync(this.lastSyncFile, "utf-8");
      const timestamp = parseInt(content.trim(), 10);
      return isNaN(timestamp) ? null : timestamp;
    } catch {
      return null;
    }
  }

  /**
   * Update the last sync timestamp to current time
   */
  updateLastSyncTimestamp(): void {
    const timestamp = Date.now();
    try {
      const { mkdirSync } = require("fs");
      const { dirname } = require("path");
      mkdirSync(dirname(this.lastSyncFile), { recursive: true });
      writeFileSync(this.lastSyncFile, timestamp.toString(), "utf-8");
    } catch {
      // Silently fail if we can't write the timestamp
      // This is non-critical functionality
    }
  }

  /**
   * Get edit information for a file since last sync
   */
  getEditInfo(filePath: string): EditInfo {
    const lastSync = this.getLastSyncTimestamp();
    const lastModified = this.getFileModificationTime(filePath);

    return {
      filePath,
      lastModified: lastModified || 0,
      wasModifiedSince:
        lastSync !== null && lastModified !== null && lastModified > lastSync,
    };
  }
}
