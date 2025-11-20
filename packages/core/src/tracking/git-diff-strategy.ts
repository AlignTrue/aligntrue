/**
 * Git-based change detection strategy
 * Tracks changes using git diff between syncs
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import type { Section } from "../parsing/section-extractor.js";
import { extractSections } from "../parsing/section-extractor.js";

/**
 * Result of change detection
 */
export interface SectionChanges {
  added: Section[];
  modified: Section[];
  unchanged: Section[];
  removed: string[]; // Fingerprints of removed sections
}

/**
 * Sync manifest stored in .aligntrue/.sync-manifest
 */
interface SyncManifest {
  last_sync: string; // ISO timestamp
  last_git_commit?: string; // Git commit hash
  tracked_files: Record<string, string>; // file path → last known commit
}

/**
 * Git-based change detection strategy
 * Uses git diff to identify changed sections between syncs
 */
export class GitDiffStrategy {
  private workspaceRoot: string;
  private manifestPath: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.manifestPath = join(workspaceRoot, ".aligntrue", ".sync-manifest");
  }

  /**
   * Check if git is available in this workspace
   */
  async isAvailable(): Promise<boolean> {
    try {
      execSync("git rev-parse --git-dir", {
        cwd: this.workspaceRoot,
        stdio: "ignore",
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect changes in a file since last sync
   */
  async detectChanges(filePath: string): Promise<SectionChanges> {
    const manifest = this.loadManifest();
    const absolutePath = join(this.workspaceRoot, filePath);

    // If file doesn't exist, return empty result
    if (!existsSync(absolutePath)) {
      return {
        added: [],
        modified: [],
        unchanged: [],
        removed: [],
      };
    }

    // Get current file content and sections
    const currentContent = readFileSync(absolutePath, "utf-8");
    const currentSections = extractSections(currentContent).sections;

    // Get last sync point for this file
    const lastCommit =
      manifest.tracked_files[filePath] || manifest.last_git_commit;

    if (!lastCommit) {
      // First sync - all sections are new
      return {
        added: currentSections,
        modified: [],
        unchanged: [],
        removed: [],
      };
    }

    // Get git diff for this file
    const diff = this.getGitDiff(filePath, lastCommit);

    if (!diff || diff.trim() === "") {
      // No changes detected
      return {
        added: [],
        modified: [],
        unchanged: currentSections,
        removed: [],
      };
    }

    // Parse diff to identify changed line ranges
    const changedRanges = this.parseDiffHunks(diff);

    // Get previous content from git
    let previousSections: Section[] = [];
    try {
      const previousContent = this.getFileAtCommit(filePath, lastCommit);
      if (previousContent) {
        previousSections = extractSections(previousContent).sections;
      }
    } catch {
      // If we can't get previous content, treat all as new
      return {
        added: currentSections,
        modified: [],
        unchanged: [],
        removed: [],
      };
    }

    // Build fingerprint maps
    const previousMap = new Map(
      previousSections.map((s) => [s.fingerprint, s]),
    );
    const currentMap = new Map(currentSections.map((s) => [s.fingerprint, s]));

    // Categorize sections
    const added: Section[] = [];
    const modified: Section[] = [];
    const unchanged: Section[] = [];
    const removed: string[] = [];

    // Check current sections
    for (const section of currentSections) {
      const wasInPrevious = previousMap.has(section.fingerprint);

      if (!wasInPrevious) {
        // New section
        added.push(section);
      } else {
        // Section existed before - check if it was in a changed range
        const wasChanged = this.sectionInChangedRanges(section, changedRanges);

        if (wasChanged) {
          modified.push(section);
        } else {
          unchanged.push(section);
        }
      }
    }

    // Find removed sections
    for (const [fingerprint] of previousMap) {
      if (!currentMap.has(fingerprint)) {
        removed.push(fingerprint);
      }
    }

    return { added, modified, unchanged, removed };
  }

  /**
   * Save current state as last sync point
   */
  async saveCheckpoint(filePath?: string): Promise<void> {
    try {
      const currentCommit = this.getCurrentCommit();
      const manifest = this.loadManifest();

      manifest.last_sync = new Date().toISOString();
      manifest.last_git_commit = currentCommit;

      // Update tracked file if specified
      if (filePath) {
        manifest.tracked_files[filePath] = currentCommit;
      }

      this.saveManifest(manifest);
    } catch {
      // Non-critical - fail silently
    }
  }

  /**
   * Get git diff between last sync and current state
   */
  private getGitDiff(filePath: string, since: string): string {
    try {
      return execSync(`git diff ${since}..HEAD -- "${filePath}"`, {
        cwd: this.workspaceRoot,
        encoding: "utf-8",
      }).toString();
    } catch {
      return "";
    }
  }

  /**
   * Get file content at a specific commit
   */
  private getFileAtCommit(filePath: string, commit: string): string | null {
    try {
      return execSync(`git show ${commit}:"${filePath}"`, {
        cwd: this.workspaceRoot,
        encoding: "utf-8",
      }).toString();
    } catch {
      return null;
    }
  }

  /**
   * Get current git commit hash
   */
  private getCurrentCommit(): string {
    return execSync("git rev-parse HEAD", {
      cwd: this.workspaceRoot,
      encoding: "utf-8",
    })
      .toString()
      .trim();
  }

  /**
   * Parse diff hunks to extract changed line ranges
   * Returns array of {start, end} line numbers
   */
  private parseDiffHunks(diff: string): Array<{ start: number; end: number }> {
    const ranges: Array<{ start: number; end: number }> = [];
    const hunkRegex = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/g;

    let match;
    while ((match = hunkRegex.exec(diff)) !== null) {
      const start = parseInt(match[1]!, 10);
      const count = match[2] ? parseInt(match[2], 10) : 1;
      ranges.push({
        start,
        end: start + count,
      });
    }

    return ranges;
  }

  /**
   * Check if a section overlaps with any changed line ranges
   */
  private sectionInChangedRanges(
    section: Section,
    ranges: Array<{ start: number; end: number }>,
  ): boolean {
    for (const range of ranges) {
      // Check if section overlaps with this range
      if (
        (section.lineStart >= range.start && section.lineStart <= range.end) ||
        (section.lineEnd >= range.start && section.lineEnd <= range.end) ||
        (section.lineStart <= range.start && section.lineEnd >= range.end)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Load sync manifest
   */
  private loadManifest(): SyncManifest {
    if (!existsSync(this.manifestPath)) {
      return {
        last_sync: new Date().toISOString(),
        tracked_files: {},
      };
    }

    try {
      const content = readFileSync(this.manifestPath, "utf-8");
      return JSON.parse(content) as SyncManifest;
    } catch {
      return {
        last_sync: new Date().toISOString(),
        tracked_files: {},
      };
    }
  }

  /**
   * Save sync manifest
   */
  private saveManifest(manifest: SyncManifest): void {
    const dir = dirname(this.manifestPath);
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // Directory may already exist
    }
    writeFileSync(
      this.manifestPath,
      JSON.stringify(manifest, null, 2),
      "utf-8",
    );
  }
}
