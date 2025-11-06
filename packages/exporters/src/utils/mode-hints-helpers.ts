/**
 * Shared utilities for mode hints integration across exporters
 * Consolidates common patterns to reduce duplication and improve maintainability
 */

import type { AlignRule } from "@aligntrue/schema";
import {
  getModeHints as getConfigModeHints,
  type AlignTrueConfig,
  type ModeHints,
} from "@aligntrue/core";
import { prioritizeRulesForCapExport, renderModeMarkers } from "./index.js";

/**
 * Mode hints configuration extracted from config
 */
export interface ModeHintsConfig {
  modeHints: string;
  maxBlocks: number;
  maxTokens: number;
}

/**
 * Result of applying rule prioritization with warnings
 */
export interface PrioritizationResult {
  includedIds: Set<string>;
  warnings: string[];
}

/**
 * Extract mode hints configuration from exporter config
 * Provides sensible defaults for all parameters
 *
 * @param exporterName Name of the exporter (for config lookup)
 * @param config Optional AlignTrue configuration
 * @returns Mode hints configuration with defaults applied
 */
export function extractModeConfig(
  exporterName: string,
  config?: AlignTrueConfig,
): ModeHintsConfig {
  const modeHints = config
    ? getConfigModeHints(exporterName, config)
    : "metadata_only";
  const maxBlocks = config?.export?.max_hint_blocks ?? 20;
  const maxTokens = config?.export?.max_hint_tokens ?? 1600;

  return { modeHints, maxBlocks, maxTokens };
}

/**
 * Apply rule prioritization with token/block caps
 * Returns set of included rule IDs and warning messages
 *
 * @param rules All rules to prioritize
 * @param modeHints Mode hints setting (affects token estimation)
 * @param maxBlocks Maximum number of rules to include
 * @param maxTokens Maximum token budget
 * @returns Set of included rule IDs and warnings array
 */
export function applyRulePrioritization(
  rules: AlignRule[],
  modeHints: string,
  maxBlocks: number,
  maxTokens: number,
): PrioritizationResult {
  const includeHintText = modeHints === "hints";

  const { included, dropped, totalTokens } = prioritizeRulesForCapExport(
    rules,
    maxBlocks,
    maxTokens,
    includeHintText,
  );

  const warnings: string[] = [];
  if (dropped.length > 0) {
    warnings.push(
      `Dropped ${dropped.length} rules to stay within caps (${totalTokens}/${maxTokens} tokens, ${included.length}/${maxBlocks} blocks). ` +
        `Dropped: ${dropped.map((d) => `${d.rule_id} (${d.mode}, ${d.estimated_tokens}t)`).join(", ")}`,
    );
  }

  return {
    includedIds: new Set(included.map((r) => r.id)),
    warnings,
  };
}

/**
 * Generate session preface lines for hints mode
 * Returns empty array for non-hints modes
 *
 * @param modeHints Mode hints setting
 * @returns Array of preface lines to insert after header
 */
export function generateSessionPreface(modeHints: string): string[] {
  if (modeHints !== "hints") {
    return [];
  }

  return [
    "",
    "> **Note:** Only use the following rules when relevant to the current change.",
    "> Relevance means the change matches any listed globs or the description clearly applies.",
    "",
  ];
}

/**
 * Wrap rule content with mode markers (prefix/suffix)
 * Handles all mode hint states (off, metadata_only, hints, native)
 *
 * @param rule The rule to wrap
 * @param content The rule content to wrap (should NOT include newlines at start/end)
 * @param modeHints Mode hints setting
 * @returns Complete rule section with markers applied
 */
export function wrapRuleWithMarkers(
  rule: AlignRule,
  content: string,
  modeHints: ModeHints,
): string {
  const { prefix, suffix } = renderModeMarkers(rule, modeHints);
  return prefix + content + suffix;
}

/**
 * Helper to check if a rule should be included based on prioritization
 *
 * @param ruleId Rule ID to check
 * @param includedIds Set of included rule IDs from prioritization
 * @returns True if rule should be included
 */
export function shouldIncludeRule(
  ruleId: string,
  includedIds: Set<string>,
): boolean {
  return includedIds.has(ruleId);
}
