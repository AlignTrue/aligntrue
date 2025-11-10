/**
 * Change detector - selects appropriate strategy for tracking section changes
 */

import type { Section } from "../parsing/section-extractor.js";
import { GitDiffStrategy } from "./git-diff-strategy.js";
import { ContentHashStrategy } from "./content-hash-strategy.js";

/**
 * Unified change detection result
 */
export interface SectionChanges {
  added: Section[];
  modified: Section[];
  unchanged: Section[];
  removed: string[]; // Fingerprints of removed sections
}

/**
 * Change detection strategy interface
 */
export interface ChangeDetectionStrategy {
  isAvailable(): Promise<boolean>;
  detectChanges(filePath: string): Promise<SectionChanges>;
  saveCheckpoint(filePath: string, sections?: Section[]): Promise<void>;
}

/**
 * Change detector - intelligently selects between git and content-based tracking
 */
export class ChangeDetector {
  private workspaceRoot: string;
  private strategy: ChangeDetectionStrategy | null = null;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Detect changes in a file
   */
  async detect(filePath: string): Promise<SectionChanges> {
    const strategy = await this.selectStrategy();
    return strategy.detectChanges(filePath);
  }

  /**
   * Save checkpoint after successful sync
   */
  async saveCheckpoint(filePath: string, sections?: Section[]): Promise<void> {
    const strategy = await this.selectStrategy();
    await strategy.saveCheckpoint(filePath, sections);
  }

  /**
   * Select appropriate change detection strategy
   * Prefers git-based (faster, more accurate) with fallback to content hashing
   */
  private async selectStrategy(): Promise<ChangeDetectionStrategy> {
    // Return cached strategy if available
    if (this.strategy) {
      return this.strategy;
    }

    // Try git strategy first
    const gitStrategy = new GitDiffStrategy(this.workspaceRoot);
    if (await gitStrategy.isAvailable()) {
      this.strategy = gitStrategy;
      return gitStrategy;
    }

    // Fallback to content hash strategy
    const contentStrategy = new ContentHashStrategy(this.workspaceRoot);
    this.strategy = contentStrategy;
    return contentStrategy;
  }

  /**
   * Get the name of the active strategy (for debugging/logging)
   */
  async getStrategyName(): Promise<string> {
    const strategy = await this.selectStrategy();

    if (strategy instanceof GitDiffStrategy) {
      return "git";
    } else if (strategy instanceof ContentHashStrategy) {
      return "content-hash";
    }

    return "unknown";
  }

  /**
   * Reset cached strategy (useful for testing)
   */
  resetStrategy(): void {
    this.strategy = null;
  }
}

/**
 * Format changes summary for display
 */
export function formatChangesSummary(changes: SectionChanges): string[] {
  const lines: string[] = [];

  if (changes.added.length > 0) {
    lines.push(`Added ${changes.added.length} section(s):`);
    changes.added.forEach((s) => lines.push(`  + ${s.heading}`));
  }

  if (changes.modified.length > 0) {
    lines.push(`Modified ${changes.modified.length} section(s):`);
    changes.modified.forEach((s) => lines.push(`  ~ ${s.heading}`));
  }

  if (changes.removed.length > 0) {
    lines.push(`Removed ${changes.removed.length} section(s)`);
  }

  if (
    changes.added.length === 0 &&
    changes.modified.length === 0 &&
    changes.removed.length === 0
  ) {
    lines.push("No changes detected");
  }

  return lines;
}
