/**
 * Agent pullback logic (Agent → IR)
 * Handles loading agent files, parsing them, and updating the IR.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, resolve as resolvePath } from "path";
import { stringify as stringifyYaml } from "yaml";
import { glob } from "glob";
import type { AlignSection } from "@aligntrue/schema";
import type { AlignTrueConfig, AlignTrueMode } from "../config/index.js";
import { loadConfig } from "../config/index.js";
import { getAlignTruePaths } from "../paths.js";
import { loadIRAndResolvePlugs } from "./ir-loader.js";
import { generateAndWriteLockfile } from "./lockfile-manager.js";
import { updateLastSyncTimestamp } from "./tracking.js";
import { generateFingerprint } from "./multi-file-parser.js";
import type { SyncOptions, SyncResult, AuditEntry } from "./engine.js";

/**
 * Sync from agent to IR (pullback direction)
 * Requires explicit --accept-agent flag
 */
export async function syncFromAgent(
  agent: string,
  irPath: string,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const warnings: string[] = [];
  const written: string[] = [];
  const auditTrail: AuditEntry[] = [];

  try {
    // Load config
    const config = await loadConfig(options.configPath);

    // Load IR (force loading from source, ignoring multi-file edit_source for now as we are overwriting IR)
    // We need to load the current IR to preserve metadata/other sections if we were merging,
    // but syncFromAgent logic currently replaces sections?
    // "this.ir!.sections = agentRules;" -> yes, it replaces sections.

    // Use loadIRAndResolvePlugs to get current state
    const loadOptions: {
      mode: AlignTrueMode;
      maxFileSizeMb: number;
      force: boolean;
      config: AlignTrueConfig;
      plugFills?: Record<string, string>;
    } = {
      mode: config.mode,
      maxFileSizeMb: config.performance?.max_file_size_mb || 10,
      force: options.force || false,
      config: config,
    };

    // We don't strictly need plug resolution for pullback, but good to have consistent state
    if (config.plugs?.fills) {
      loadOptions.plugFills = config.plugs.fills;
    }

    const loadResult = await loadIRAndResolvePlugs(irPath, loadOptions);

    if (!loadResult.success) {
      throw new Error(
        `Failed to load IR: ${loadResult.warnings.join(", ")}` ||
          "Unknown error",
      );
    }

    const ir = loadResult.ir;

    // Audit trail: Starting agent→IR sync
    auditTrail.push({
      action: "update",
      target: irPath,
      source: agent,
      timestamp: new Date().toISOString(),
      details: `Starting agent→IR sync from ${agent}`,
    });

    // Load agent rules for explicit --accept-agent pullback
    const agentRules = await loadAgentRules(agent, config);

    if (!agentRules || agentRules.length === 0) {
      warnings.push(`No rules found in agent ${agent}`);
      return {
        success: true,
        written: [],
        warnings,
        auditTrail,
      };
    }

    // Audit trail: Agent rules loaded
    auditTrail.push({
      action: "update",
      target: agent,
      source: agent,
      timestamp: new Date().toISOString(),
      details: `Loaded ${agentRules.length} rules from agent`,
    });

    // Audit trail: Accepting changes
    auditTrail.push({
      action: "update",
      target: irPath,
      source: agent,
      timestamp: new Date().toISOString(),
      details: `Accepting all changes from ${agent} (conflict detection not yet implemented for sections)`,
    });

    // Team mode: full conflict detection (placeholder from original code)
    const conflictResult = {
      status: "success" as const,
      conflicts: [],
    };

    if (conflictResult.conflicts.length > 0) {
      auditTrail.push({
        action: "conflict",
        target: irPath,
        source: agent,
        timestamp: new Date().toISOString(),
        details: `Detected ${conflictResult.conflicts.length} conflict(s)`,
      });
    }

    // Write updated IR (if not dry-run)
    if (!options.dryRun) {
      // Update IR with agent sections
      ir.sections = agentRules;

      // Write IR to file
      const irContent = stringifyYaml(ir);
      writeFileSync(irPath, irContent, "utf-8");
      written.push(irPath);

      auditTrail.push({
        action: "update",
        target: irPath,
        source: agent,
        timestamp: new Date().toISOString(),
        details: `Updated IR from agent with ${agentRules.length} sections`,
      });

      // Generate/update lockfile (delegated)
      const lockfileGeneration = generateAndWriteLockfile(
        ir,
        config,
        process.cwd(),
        options.dryRun || false,
      );
      written.push(...lockfileGeneration.written);
      if (lockfileGeneration.warnings) {
        warnings.push(...lockfileGeneration.warnings);
      }
      if (lockfileGeneration.auditTrail) {
        auditTrail.push(...lockfileGeneration.auditTrail);
      }

      // Update last sync timestamp after accepting agent changes
      const cwd = resolvePath(irPath, "..", "..");
      updateLastSyncTimestamp(cwd);
    }

    return {
      success: true,
      written,
      warnings,
      auditTrail,
    };
  } catch (_err) {
    return {
      success: false,
      written: [],
      warnings: [_err instanceof Error ? _err.message : String(_err)],
      auditTrail,
    };
  }
}

/**
 * Load agent sections from an on-disk agent file
 */
async function loadAgentRules(
  agent: string,
  config: AlignTrueConfig,
): Promise<AlignSection[]> {
  const cwd = process.cwd();
  const paths = getAlignTruePaths(cwd);

  // Map agent name to file path
  const agentFilePaths: Record<string, string> = {
    agents: paths.agentsMd(),
  };

  let filePath = agentFilePaths[agent];

  // Special handling for Cursor: check config for edit_source pattern
  if (agent === "cursor") {
    const editSource = config.sync?.edit_source;

    // Use configured pattern if available, otherwise default
    const cursorPattern = Array.isArray(editSource)
      ? editSource.find((p) => p.includes(".cursor") || p.includes(".mdc"))
      : editSource &&
          (editSource.includes(".cursor") || editSource.includes(".mdc"))
        ? editSource
        : join(cwd, ".cursor/rules/aligntrue.mdc"); // Fallback to default

    if (cursorPattern && cursorPattern.includes("*")) {
      // It's a glob pattern - we need to find matching files
      const matches = await glob(cursorPattern, { cwd, absolute: true });

      if (matches.length > 0) {
        // Prefer aligntrue.mdc if present in matches
        const preferred = matches.find((p) => p.endsWith("aligntrue.mdc"));
        filePath = preferred || matches[0];
      } else {
        // No matches found for glob
        filePath = join(cwd, ".cursor/rules/aligntrue.mdc");
      }
    } else {
      // Direct path
      filePath = cursorPattern
        ? resolvePath(cwd, cursorPattern)
        : join(cwd, ".cursor/rules/aligntrue.mdc");
    }
  }

  if (!filePath || !existsSync(filePath)) {
    throw new Error(`Agent file not found: ${agent}`);
  }

  // Parse content
  const content = readFileSync(filePath, "utf-8");

  // Dynamic import of parser from exporters package
  // Note: This requires @aligntrue/exporters to be installed
  const parseModule = "@aligntrue/exporters/utils/section-parser";
  // @ts-ignore - Dynamic import of peer dependency (resolved at runtime)
  const parsers = await import(parseModule);

  let parsed: {
    sections: Array<{
      heading: string;
      content: string;
      level: number;
      hash: string;
    }>;
  };

  if (agent === "agents") {
    parsed = parsers.parseAgentsMd(content);
  } else if (agent === "cursor") {
    parsed = parsers.parseCursorMdc(content);
  } else {
    throw new Error(`Unsupported agent for import: ${agent}`);
  }

  // Convert parsed sections to AlignSection format
  return parsed.sections.map((s) => ({
    heading: s.heading,
    content: s.content,
    level: s.level,
    fingerprint: generateFingerprint(s.heading),
  }));
}
