/**
 * Content hash-based change detection strategy
 * Fallback for non-git environments - tracks changes by comparing content hashes
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { computeHash } from "@aligntrue/schema";
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
 * Tracking data for a file
 */
interface FileTracking {
  last_sync: string; // ISO timestamp
  sections: Record<string, SectionTrackingData>; // heading → tracking data
}

/**
 * Tracking data for a single section
 */
interface SectionTrackingData {
  fingerprint: string; // Last known fingerprint
  contentHash: string; // Last known content hash
}

/**
 * Content hash-based change detection strategy
 * Stores section content hashes and compares to detect changes
 */
export class ContentHashStrategy {
  private workspaceRoot: string;
  private trackingDir: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.trackingDir = join(workspaceRoot, ".aligntrue", ".content-tracking");
  }

  /**
   * This strategy is always available (no dependencies)
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Detect changes in a file since last sync
   */
  async detectChanges(filePath: string): Promise<SectionChanges> {
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

    // Load previous tracking data
    const tracking = this.loadTracking(filePath);

    if (!tracking || Object.keys(tracking.sections).length === 0) {
      // First sync - all sections are new
      return {
        added: currentSections,
        modified: [],
        unchanged: [],
        removed: [],
      };
    }

    // Build current heading map
    const currentByHeading = new Map<string, Section>();
    for (const section of currentSections) {
      currentByHeading.set(section.heading, section);
    }

    // Categorize sections
    const added: Section[] = [];
    const modified: Section[] = [];
    const unchanged: Section[] = [];
    const removed: string[] = [];

    // Check current sections (track by heading for modifications)
    for (const section of currentSections) {
      const previousData = tracking.sections[section.heading];
      const currentHash = this.hashSection(section);

      if (!previousData) {
        // New section (new heading)
        added.push(section);
      } else if (previousData.contentHash !== currentHash) {
        // Modified section (heading exists, but content changed)
        modified.push(section);
      } else {
        // Unchanged section
        unchanged.push(section);
      }
    }

    // Find removed sections (headings that no longer exist)
    for (const heading of Object.keys(tracking.sections)) {
      if (!currentByHeading.has(heading)) {
        const previousData = tracking.sections[heading]!;
        removed.push(previousData.fingerprint);
      }
    }

    return { added, modified, unchanged, removed };
  }

  /**
   * Save current state as tracking checkpoint
   */
  async saveCheckpoint(filePath: string, sections: Section[]): Promise<void> {
    const tracking: FileTracking = {
      last_sync: new Date().toISOString(),
      sections: {},
    };

    // Store hash and fingerprint for each section (keyed by heading)
    for (const section of sections) {
      tracking.sections[section.heading] = {
        fingerprint: section.fingerprint,
        contentHash: this.hashSection(section),
      };
    }

    this.saveTracking(filePath, tracking);
  }

  /**
   * Hash a section's content for comparison
   */
  private hashSection(section: Section): string {
    // Include heading and content in hash to detect any changes
    const content = `${section.heading}\n${section.content}`;
    return computeHash(content);
  }

  /**
   * Get tracking file path for a source file
   */
  private getTrackingPath(filePath: string): string {
    // Normalize file path for tracking filename
    const normalized = filePath.replace(/[^a-z0-9]/gi, "-");
    return join(this.trackingDir, `${normalized}.json`);
  }

  /**
   * Load tracking data for a file
   */
  private loadTracking(filePath: string): FileTracking | null {
    const trackingPath = this.getTrackingPath(filePath);

    if (!existsSync(trackingPath)) {
      return null;
    }

    try {
      const content = readFileSync(trackingPath, "utf-8");
      return JSON.parse(content) as FileTracking;
    } catch {
      return null;
    }
  }

  /**
   * Save tracking data for a file
   */
  private saveTracking(filePath: string, tracking: FileTracking): void {
    const trackingPath = this.getTrackingPath(filePath);
    const dir = dirname(trackingPath);

    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // Directory may already exist
    }

    writeFileSync(trackingPath, JSON.stringify(tracking, null, 2), "utf-8");
  }
}
