/**
 * Conflict detection for two-way sync
 * Compares IR vs agent state and generates structured diffs
 */

import type { AlignRule } from "@aligntrue/schema";
import type { AlignTrueConfig } from "../config/index.js";

/**
 * Conflict resolution strategy
 */
export enum ConflictResolutionStrategy {
  KEEP_IR = "keep_ir",
  ACCEPT_AGENT = "accept_agent",
  MANUAL = "manual",
  ABORT = "abort",
}

/**
 * Conflict record with field-level differences
 */
export interface Conflict {
  agent: string;
  ruleId: string;
  field: string;
  irValue: unknown;
  agentValue: unknown;
  diff: string;
}

/**
 * Resolution applied to a conflict
 */
export interface ConflictResolution {
  ruleId: string;
  field: string;
  strategy: ConflictResolutionStrategy;
  appliedValue: unknown;
  timestamp: string;
}

/**
 * Result of conflict detection
 */
export interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflicts: Conflict[];
}

/**
 * Check if a field is in the volatile list
 */
function isVolatileField(
  field: string,
  volatileFields: string[] = [],
): boolean {
  return volatileFields.some((pattern) => {
    // Support wildcards like "cursor.session_id" or "*.volatile_field"
    // Escape regex special characters EXCEPT '*' which we want to replace with '.*'
    const escapedPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // Escape regex metacharacters
      .replace(/\*/g, ".*"); // Then replace * with .*

    const regex = new RegExp(`^${escapedPattern}$`);
    return regex.test(field);
  });
}

/**
 * Extract volatile fields from vendor._meta.volatile
 */
function getVolatileFields(rule: AlignRule): string[] {
  const vendor = rule.vendor as Record<string, unknown> | undefined;
  if (!vendor || typeof vendor !== "object") {
    return [];
  }

  const meta = vendor["_meta"] as Record<string, unknown> | undefined;
  if (!meta || typeof meta !== "object") {
    return [];
  }

  const volatile = meta["volatile"];
  if (Array.isArray(volatile)) {
    return volatile.filter((v) => typeof v === "string") as string[];
  }

  return [];
}

/**
 * Deep equality check for values
 * Note: undefined !== null !== []
 */
function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  // Treat undefined and null as different values
  if (a === undefined || b === undefined) return false;
  if (a === null || b === null) return a === b;

  if (typeof a !== typeof b) return false;

  if (typeof a === "object" && typeof b === "object") {
    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, idx) => deepEquals(val, b[idx]));
    }

    // Handle objects
    if (Array.isArray(a) !== Array.isArray(b)) return false;

    const aKeys = Object.keys(a as object).sort();
    const bKeys = Object.keys(b as object).sort();

    if (aKeys.length !== bKeys.length) return false;
    if (aKeys.join(",") !== bKeys.join(",")) return false;

    return aKeys.every((key) =>
      deepEquals(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      ),
    );
  }

  return false;
}

/**
 * Generate a human-readable diff string
 */
function generateDiff(
  field: string,
  irValue: unknown,
  agentValue: unknown,
): string {
  const irStr = JSON.stringify(irValue, null, 2);
  const agentStr = JSON.stringify(agentValue, null, 2);

  return (
    `Field: ${field}\n` + `IR value:\n${irStr}\n` + `Agent value:\n${agentStr}`
  );
}

/**
 * Compare vendor bags, ignoring volatile fields
 */
function compareVendorBags(
  irVendor: Record<string, unknown> | undefined,
  agentVendor: Record<string, unknown> | undefined,
  volatileFields: string[],
  agentName: string,
  ruleId: string,
): Conflict[] {
  const conflicts: Conflict[] = [];

  // If both are undefined, no conflict
  if (!irVendor && !agentVendor) return conflicts;

  // Normalize to empty objects if undefined
  const ir = irVendor || {};
  const agent = agentVendor || {};

  // Get all agent-specific keys (exclude _meta)
  const agentKeys = Object.keys(agent).filter((k) => k !== "_meta");
  const irKeys = Object.keys(ir).filter((k) => k !== "_meta");

  // Check for differences in agent-specific vendor bags
  for (const key of new Set([...agentKeys, ...irKeys])) {
    const fullField = `vendor.${key}`;

    // Skip if this entire vendor bag is volatile
    if (isVolatileField(fullField, volatileFields)) {
      continue;
    }

    const irValue = ir[key];
    const agentValue = agent[key];

    // Skip if values are equal
    if (deepEquals(irValue, agentValue)) {
      continue;
    }

    // Check individual fields within the vendor bag
    if (
      typeof irValue === "object" &&
      typeof agentValue === "object" &&
      irValue &&
      agentValue
    ) {
      const irObj = irValue as Record<string, unknown>;
      const agentObj = agentValue as Record<string, unknown>;

      for (const subKey of new Set([
        ...Object.keys(irObj),
        ...Object.keys(agentObj),
      ])) {
        const fullSubField = `${fullField}.${subKey}`;
        // Check volatile with both full path and vendor-relative path
        const vendorRelativePath = fullSubField.replace(/^vendor\./, "");

        // Skip volatile fields
        if (
          isVolatileField(fullSubField, volatileFields) ||
          isVolatileField(vendorRelativePath, volatileFields)
        ) {
          continue;
        }

        const irSubValue = irObj[subKey];
        const agentSubValue = agentObj[subKey];

        if (!deepEquals(irSubValue, agentSubValue)) {
          conflicts.push({
            agent: agentName,
            ruleId,
            field: fullSubField,
            irValue: irSubValue,
            agentValue: agentSubValue,
            diff: generateDiff(fullSubField, irSubValue, agentSubValue),
          });
        }
      }
    } else {
      // Entire vendor bag differs
      conflicts.push({
        agent: agentName,
        ruleId,
        field: fullField,
        irValue,
        agentValue,
        diff: generateDiff(fullField, irValue, agentValue),
      });
    }
  }

  return conflicts;
}

/**
 * Conflict detector for comparing IR vs agent state
 */
export class ConflictDetector {
  /**
   * Detect conflicts between IR rules and agent rules
   */
  detectConflicts(
    agentName: string,
    irRules: AlignRule[],
    agentRules: AlignRule[],
  ): ConflictDetectionResult {
    const conflicts: Conflict[] = [];

    // Create lookup maps by rule ID
    const irMap = new Map(irRules.map((r) => [r.id, r]));
    const agentMap = new Map(agentRules.map((r) => [r.id, r]));

    // Check each IR rule against agent rules
    for (const [ruleId, irRule] of irMap) {
      const agentRule = agentMap.get(ruleId);

      // If rule doesn't exist in agent, no conflict (new rule)
      if (!agentRule) {
        continue;
      }

      // Get volatile fields for this rule
      const volatileFields = getVolatileFields(irRule);

      // Compare core fields (excluding vendor bags initially)
      const coreFields = [
        "severity",
        "applies_to",
        "guidance",
        "tags",
      ] as const;

      for (const field of coreFields) {
        const irValue = irRule[field];
        const agentValue = agentRule[field];

        if (!deepEquals(irValue, agentValue)) {
          conflicts.push({
            agent: agentName,
            ruleId,
            field,
            irValue,
            agentValue,
            diff: generateDiff(field, irValue, agentValue),
          });
        }
      }

      // Compare vendor bags (ignore volatile fields)
      const vendorConflicts = compareVendorBags(
        irRule.vendor as Record<string, unknown> | undefined,
        agentRule.vendor as Record<string, unknown> | undefined,
        volatileFields,
        agentName,
        ruleId,
      );

      conflicts.push(...vendorConflicts);
    }

    // Check for rules in agent that don't exist in IR (deleted rules)
    for (const [ruleId, agentRule] of agentMap) {
      if (!irMap.has(ruleId)) {
        conflicts.push({
          agent: agentName,
          ruleId,
          field: "(entire rule)",
          irValue: undefined,
          agentValue: agentRule,
          diff: generateDiff("(entire rule)", undefined, agentRule),
        });
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  }

  /**
   * Resolve a conflict by applying the specified strategy
   */
  resolveConflict(
    conflict: Conflict,
    strategy: ConflictResolutionStrategy,
  ): ConflictResolution {
    let appliedValue: unknown;

    switch (strategy) {
      case ConflictResolutionStrategy.KEEP_IR:
        appliedValue = conflict.irValue;
        break;
      case ConflictResolutionStrategy.ACCEPT_AGENT:
        appliedValue = conflict.agentValue;
        break;
      case ConflictResolutionStrategy.MANUAL:
        // Manual means the value will be set by the caller
        appliedValue = conflict.irValue; // default to IR
        break;
      case ConflictResolutionStrategy.ABORT:
        throw new Error(
          `Resolution aborted for rule ${conflict.ruleId}, field ${conflict.field}`,
        );
      default:
        throw new Error(`Unknown resolution strategy: ${strategy}`);
    }

    return {
      ruleId: conflict.ruleId,
      field: conflict.field,
      strategy,
      appliedValue,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Apply resolutions to IR rules, returning updated rules
   */
  applyResolutions(
    irRules: AlignRule[],
    resolutions: ConflictResolution[],
  ): AlignRule[] {
    // Create a mutable copy of rules
    const updatedRules = irRules.map((rule) => ({ ...rule }));
    const ruleMap = new Map(updatedRules.map((r) => [r.id, r]));

    for (const resolution of resolutions) {
      const rule = ruleMap.get(resolution.ruleId);
      if (!rule) {
        continue; // Rule doesn't exist, skip
      }

      // Handle nested fields (e.g., vendor.cursor.ai_hint)
      if (resolution.field.includes(".")) {
        this.setNestedField(rule, resolution.field, resolution.appliedValue);
      } else {
        // Simple field assignment
        (rule as Record<string, unknown>)[resolution.field] =
          resolution.appliedValue;
      }
    }

    return Array.from(ruleMap.values());
  }

  /**
   * Set a nested field value (e.g., vendor.cursor.ai_hint)
   * Protected against prototype pollution attacks
   */
  private setNestedField(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    // Reject dangerous prototype keys to prevent prototype pollution
    const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

    const parts = path.split(".");
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!part) continue; // Skip empty parts

      // Security: Prevent prototype pollution
      if (DANGEROUS_KEYS.has(part)) {
        throw new Error(
          `Security: Invalid path component '${part}' - cannot modify object prototype`,
        );
      }

      if (!(part in current)) {
        current[part] = Object.create(null);
      }

      const next = current[part];
      if (
        typeof next !== "object" ||
        next === null ||
        (!Object.prototype.hasOwnProperty.call(next, "constructor") &&
          next.constructor !== Object)
      ) {
        throw new Error(
          `Security: Invalid path component '${part}' - cannot modify non-object prototype`,
        );
      }

      current = next as Record<string, unknown>;
    }

    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      // Security: Prevent prototype pollution
      if (DANGEROUS_KEYS.has(lastPart)) {
        throw new Error(
          `Security: Invalid path component '${lastPart}' - cannot modify object prototype`,
        );
      }
      current[lastPart] = value;
    }
  }

  /**
   * Generate a human-readable conflict report
   */
  generateConflictReport(conflicts: Conflict[]): string {
    if (conflicts.length === 0) {
      return "No conflicts detected.";
    }

    const lines: string[] = [];
    lines.push(`⚠️  ${conflicts.length} conflict(s) detected:\n`);

    // Group conflicts by rule ID
    const groupedConflicts = new Map<string, Conflict[]>();
    for (const conflict of conflicts) {
      if (!groupedConflicts.has(conflict.ruleId)) {
        groupedConflicts.set(conflict.ruleId, []);
      }
      groupedConflicts.get(conflict.ruleId)!.push(conflict);
    }

    for (const [ruleId, ruleConflicts] of groupedConflicts) {
      lines.push(`Rule: ${ruleId}`);
      const firstConflict = ruleConflicts[0];
      if (firstConflict) {
        lines.push(`Agent: ${firstConflict.agent}`);
      }
      lines.push("");

      for (const conflict of ruleConflicts) {
        lines.push(`  Field: ${conflict.field}`);
        lines.push(`  IR value:    ${JSON.stringify(conflict.irValue)}`);
        lines.push(`  Agent value: ${JSON.stringify(conflict.agentValue)}`);
        lines.push("");
      }
    }

    lines.push("Choose how to resolve:");
    lines.push("  [i] Keep IR version (discard agent changes)");
    lines.push("  [a] Accept agent version (overwrite IR)");
    lines.push("  [d] Show detailed diff");
    lines.push("  [q] Quit without changes");

    return lines.join("\n");
  }
}

/**
 * Determine if solo mode fast path should be used
 * Solo mode with auto-pull skips conflict detection entirely
 */
export function shouldUseSoloFastPath(
  config: AlignTrueConfig,
  agentName: string,
): boolean {
  // Only for solo mode
  if (config.mode !== "solo") {
    return false;
  }

  // Only if auto_pull is enabled
  if (!config.sync?.auto_pull) {
    return false;
  }

  // Only if this is the primary agent
  if (config.sync?.primary_agent && config.sync.primary_agent !== agentName) {
    return false;
  }

  // Only if on_conflict is set to accept_agent
  if (config.sync?.on_conflict !== "accept_agent") {
    return false;
  }

  return true;
}
