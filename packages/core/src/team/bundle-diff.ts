/**
 * Bundle comparison utilities for team approval workflow
 */

import type { AlignSection } from "@aligntrue/schema";
import { existsSync } from "fs";
import { resolve } from "path";

export interface BundleDiff {
  added: Array<{ heading: string; lines: number }>;
  modified: Array<{
    heading: string;
    linesAdded: number;
    linesRemoved: number;
  }>;
  removed: Array<{ heading: string; lines: number }>;
}

export interface DetailedSectionDiff {
  heading: string;
  hunks: Array<{
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: Array<{ type: "context" | "add" | "remove"; content: string }>;
  }>;
}

export interface DetailedBundleDiff {
  added: AlignSection[];
  modified: DetailedSectionDiff[];
  removed: AlignSection[];
}

/**
 * Compare two bundles and return a summary diff
 */
export async function compareBundles(
  previousHash: string,
  currentHash: string,
  cwd: string,
): Promise<BundleDiff> {
  // Load bundles from .aligntrue directory
  const bundlePath = resolve(cwd, ".aligntrue/.bundle.yaml");

  if (!existsSync(bundlePath)) {
    throw new Error("Bundle file not found. Run 'aligntrue sync' first.");
  }

  // For now, we'll load the current bundle and compare with approved
  // In a full implementation, we'd need to track previous bundles
  const { loadIR } = await import("../sync/ir-loader.js");
  const rulesPath = resolve(cwd, ".aligntrue/.rules.yaml");

  if (!existsSync(rulesPath)) {
    throw new Error("Rules file not found. Run 'aligntrue sync' first.");
  }

  const currentBundle = await loadIR(rulesPath);

  // For MVP, we'll compare with empty previous state
  // TODO: Implement proper bundle history tracking
  const previousSections: AlignSection[] = [];
  const currentSections = currentBundle.sections || [];

  return compareSections(previousSections, currentSections);
}

/**
 * Compare two sets of sections
 */
function compareSections(
  previous: AlignSection[],
  current: AlignSection[],
): BundleDiff {
  const added: Array<{ heading: string; lines: number }> = [];
  const modified: Array<{
    heading: string;
    linesAdded: number;
    linesRemoved: number;
  }> = [];
  const removed: Array<{ heading: string; lines: number }> = [];

  // Create maps for easier lookup
  const previousMap = new Map<string, AlignSection>();
  const currentMap = new Map<string, AlignSection>();

  for (const section of previous) {
    previousMap.set(section.heading.toLowerCase().trim(), section);
  }

  for (const section of current) {
    currentMap.set(section.heading.toLowerCase().trim(), section);
  }

  // Find added and modified sections
  for (const section of current) {
    const key = section.heading.toLowerCase().trim();
    const prevSection = previousMap.get(key);

    if (!prevSection) {
      // New section
      added.push({
        heading: section.heading,
        lines: section.content.split("\n").length,
      });
    } else if (prevSection.content !== section.content) {
      // Modified section
      const prevLines = prevSection.content.split("\n");
      const currLines = section.content.split("\n");

      // Simple line count diff (not accurate but good enough for summary)
      const linesAdded = Math.max(0, currLines.length - prevLines.length);
      const linesRemoved = Math.max(0, prevLines.length - currLines.length);

      modified.push({
        heading: section.heading,
        linesAdded,
        linesRemoved,
      });
    }
  }

  // Find removed sections
  for (const section of previous) {
    const key = section.heading.toLowerCase().trim();
    if (!currentMap.has(key)) {
      removed.push({
        heading: section.heading,
        lines: section.content.split("\n").length,
      });
    }
  }

  return { added, modified, removed };
}

/**
 * Compare two bundles with detailed line-by-line diffs
 */
export async function compareDetailedBundles(
  previousHash: string,
  currentHash: string,
  cwd: string,
): Promise<DetailedBundleDiff> {
  // Load bundles
  const { loadIR } = await import("../sync/ir-loader.js");
  const rulesPath = resolve(cwd, ".aligntrue/.rules.yaml");

  if (!existsSync(rulesPath)) {
    throw new Error("Rules file not found. Run 'aligntrue sync' first.");
  }

  const currentBundle = await loadIR(rulesPath);

  // For MVP, compare with empty previous state
  const previousSections: AlignSection[] = [];
  const currentSections = currentBundle.sections || [];

  return compareDetailedSections(previousSections, currentSections);
}

/**
 * Compare sections with detailed line-by-line diffs
 */
function compareDetailedSections(
  previous: AlignSection[],
  current: AlignSection[],
): DetailedBundleDiff {
  const added: AlignSection[] = [];
  const modified: DetailedSectionDiff[] = [];
  const removed: AlignSection[] = [];

  // Create maps for easier lookup
  const previousMap = new Map<string, AlignSection>();
  const currentMap = new Map<string, AlignSection>();

  for (const section of previous) {
    previousMap.set(section.heading.toLowerCase().trim(), section);
  }

  for (const section of current) {
    currentMap.set(section.heading.toLowerCase().trim(), section);
  }

  // Find added and modified sections
  for (const section of current) {
    const key = section.heading.toLowerCase().trim();
    const prevSection = previousMap.get(key);

    if (!prevSection) {
      added.push(section);
    } else if (prevSection.content !== section.content) {
      // Generate detailed diff
      const diff = generateUnifiedDiff(
        prevSection.content,
        section.content,
        section.heading,
      );
      modified.push(diff);
    }
  }

  // Find removed sections
  for (const section of previous) {
    const key = section.heading.toLowerCase().trim();
    if (!currentMap.has(key)) {
      removed.push(section);
    }
  }

  return { added, modified, removed };
}

/**
 * Generate a unified diff for two text strings
 * Simple implementation - for production, consider using a proper diff library
 */
function generateUnifiedDiff(
  oldText: string,
  newText: string,
  heading: string,
): DetailedSectionDiff {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  const hunks: DetailedSectionDiff["hunks"] = [];
  const lines: Array<{ type: "context" | "add" | "remove"; content: string }> =
    [];

  // Simple line-by-line comparison
  const maxLen = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === newLine) {
      lines.push({ type: "context", content: oldLine || "" });
    } else {
      if (oldLine !== undefined) {
        lines.push({ type: "remove", content: oldLine });
      }
      if (newLine !== undefined) {
        lines.push({ type: "add", content: newLine });
      }
    }
  }

  // Create a single hunk for simplicity
  if (lines.length > 0) {
    hunks.push({
      oldStart: 1,
      oldLines: oldLines.length,
      newStart: 1,
      newLines: newLines.length,
      lines,
    });
  }

  return { heading, hunks };
}
