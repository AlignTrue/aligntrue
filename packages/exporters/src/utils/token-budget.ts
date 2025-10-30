/**
 * Token budget calculator and rule prioritization for mode hints
 * Prevents context bloat by capping hint exports with smart dropping
 */

import type { AlignRule } from "@aligntrue/schema";

/**
 * Canonical JSON serialization with sorted keys and no spaces
 * Ensures stable, deterministic output for diffs and hashing
 */
export function canonicalJson(obj: any): string {
  if (obj === null) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map((item) => canonicalJson(item)).join(",") + "]";
  }

  const keys = Object.keys(obj).sort();
  const pairs = keys.map((key) => `"${key}":${canonicalJson(obj[key])}`);
  return "{" + pairs.join(",") + "}";
}

/**
 * Calculate glob specificity score
 * Higher score = more specific pattern
 * Prefers: deeper paths, fewer wildcards, no double-star
 */
export function globSpecificity(pattern: string): number {
  const stars = (pattern.match(/\*/g) || []).length;
  const depth = (pattern.match(/\//g) || []).length;
  const hasDouble = pattern.includes("**") ? 1 : 0;
  return depth * 3 - stars * 2 - hasDouble * 2;
}

/**
 * Calculate rule priority for cap-based dropping
 * Higher score = higher priority (keep this rule)
 *
 * Prioritization:
 * 1. Mode score: always/intelligent (30) > files (20) > manual (10)
 * 2. Severity score: error (3) > warn (2) > info (1)
 * 3. Specificity score: from globSpecificity()
 */
export function rulePriority(rule: AlignRule): number {
  const modeScore = {
    always: 30,
    intelligent: 30,
    files: 20,
    manual: 10,
  }[rule.mode ?? "manual"];

  const sevScore = {
    error: 3,
    warn: 2,
    info: 1,
  }[rule.severity ?? "info"];

  const patterns = rule.applies_to ?? ["**/*"];
  const specScore = Math.max(...patterns.map(globSpecificity));

  return modeScore * 100 + sevScore * 10 + specScore;
}

/**
 * Estimate token count for a rule with mode hints
 * Rough approximation: 1 token ≈ 4 characters
 */
export function estimateRuleTokens(
  rule: AlignRule,
  includeHintText: boolean = true,
): number {
  // JSON marker tokens
  const marker = {
    id: rule.id,
    ...(rule.mode && { mode: rule.mode }),
    ...(rule.applies_to?.length && { applies_to: rule.applies_to }),
    ...(rule.tags?.length && { tags: rule.tags }),
  };
  const markerTokens = canonicalJson(marker).length / 4;

  // Visible hint text tokens (only if hints mode)
  const hintTokens = includeHintText
    ? (rule.description?.length || 0) / 4 + 15 // "Execution intent: ..." line
    : 0;

  // Rule content tokens (title, guidance, etc.)
  const titleTokens = (rule.title?.length || rule.id.length) / 4;
  const guidanceTokens = (rule.guidance?.length || 0) / 4;
  const descTokens = (rule.description?.length || 0) / 4;

  return Math.ceil(
    markerTokens + hintTokens + titleTokens + guidanceTokens + descTokens,
  );
}

/**
 * Token estimate with metadata
 */
export interface TokenEstimate {
  rule_id: string;
  estimated_tokens: number;
  mode: string;
  top_glob: string;
  priority: number;
}

/**
 * Result of prioritization with dropped rule details
 */
export interface PrioritizationResult {
  included: AlignRule[];
  dropped: TokenEstimate[];
  totalTokens: number;
}

/**
 * Prioritize rules for export with token/block caps
 * Drops lowest priority rules when caps exceeded
 *
 * @param rules All rules to consider
 * @param maxBlocks Maximum number of rules to include
 * @param maxTokens Maximum token budget
 * @param includeHintText Whether to include hint text in token estimate
 * @returns Included rules, dropped rule info, and total tokens
 */
export function prioritizeRulesForCapExport(
  rules: AlignRule[],
  maxBlocks: number,
  maxTokens: number,
  includeHintText: boolean = true,
): PrioritizationResult {
  // Calculate priority for each rule
  const rulesWithPriority = rules.map((rule) => ({
    rule,
    priority: rulePriority(rule),
    tokens: estimateRuleTokens(rule, includeHintText),
  }));

  // Sort by priority (highest first)
  const sorted = rulesWithPriority.sort((a, b) => b.priority - a.priority);

  const included: AlignRule[] = [];
  const dropped: TokenEstimate[] = [];
  let totalTokens = 0;

  for (const { rule, priority, tokens } of sorted) {
    if (included.length < maxBlocks && totalTokens + tokens <= maxTokens) {
      included.push(rule);
      totalTokens += tokens;
    } else {
      dropped.push({
        rule_id: rule.id,
        estimated_tokens: tokens,
        mode: rule.mode ?? "manual",
        top_glob: rule.applies_to?.[0] ?? "**/*",
        priority,
      });
    }
  }

  return { included, dropped, totalTokens };
}
