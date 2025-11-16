/**
 * Status command - Display workspace health at a glance
 */

import { existsSync } from "fs";
import { resolve } from "path";
import * as clack from "@clack/prompts";
import {
  getAlignTruePaths,
  loadConfig,
  type AlignTrueConfig,
} from "@aligntrue/core";
import { getLastSyncTimestamp } from "@aligntrue/core/sync/last-sync-tracker";
import {
  detectAgentsWithValidation,
  getAgentDisplayName,
} from "../utils/detect-agents.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";

const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--config",
    alias: "-c",
    hasValue: true,
    description: "Custom config file path (default: .aligntrue/config.yaml)",
  },
  {
    flag: "--json",
    hasValue: false,
    description: "Output status summary in JSON format",
  },
  {
    flag: "--help",
    alias: "-h",
    hasValue: false,
    description: "Show this help message",
  },
];

interface ExporterStatus {
  name: string;
  displayName: string;
  detected: boolean;
}

interface EditSourceSummary {
  raw: string;
  label: string;
}

interface StatusSummary {
  mode: AlignTrueConfig["mode"];
  configPath: string;
  cwd: string;
  lastSync: {
    timestamp: number | null;
    label: string;
    relative?: string;
    iso?: string;
    filePath: string;
  };
  exporters: {
    configured: ExporterStatus[];
    detectedButNotConfigured: ExporterStatus[];
    configuredButMissing: ExporterStatus[];
  };
  sync: {
    workflowMode: string;
    editSources: EditSourceSummary[];
    autoPull: { enabled: boolean; primaryAgent?: string | null };
    primaryAgent?: string | null;
  };
  lockfile: {
    enabled: boolean;
    mode: string;
    exists: boolean;
    path: string;
  };
  bundle: {
    enabled: boolean;
    exists: boolean;
    path: string;
  };
}

/**
 * Entry point for status command
 */
export async function status(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help) {
    showStandardHelp({
      name: "status",
      description:
        "Display AlignTrue mode, exporters, sync settings, and health",
      usage: "aligntrue status [options]",
      args: ARG_DEFINITIONS,
      examples: ["aligntrue status", "aligntrue status --json"],
      notes: [
        "Shows mode, configured exporters, detection status, last sync time,",
        "lockfile/bundle state, edit sources, and auto-pull configuration.",
      ],
    });
    return;
  }

  const cwd = process.cwd();
  const configPath = resolveConfigPath(
    parsed.flags["config"] as string | undefined,
    cwd,
  );

  if (!existsSync(configPath)) {
    clack.log.error(`Configuration file not found: ${configPath}`);
    clack.log.info("Run 'aligntrue init' to create a new configuration.");
    process.exit(1);
  }

  let config: AlignTrueConfig;
  try {
    config = await loadConfig(configPath, cwd);
  } catch (_error) {
    const message = _error instanceof Error ? _error.message : String(_error);
    clack.log.error(`Failed to load configuration:\n  ${message}`);
    process.exit(2);
  }

  const summary = buildStatusSummary(config, configPath, cwd);

  if (parsed.flags["json"]) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  renderStatus(summary);
}

/**
 * Resolve config path from flag or defaults
 */
function resolveConfigPath(pathArg: string | undefined, cwd: string): string {
  if (pathArg) {
    return resolve(cwd, pathArg);
  }
  return getAlignTruePaths(cwd).config;
}

/**
 * Build a normalized status summary
 */
function buildStatusSummary(
  config: AlignTrueConfig,
  configPath: string,
  cwd: string,
): StatusSummary {
  const paths = getAlignTruePaths(cwd);
  const exporters = config.exporters ?? [];
  const detection = detectAgentsWithValidation(cwd, exporters);

  const configured: ExporterStatus[] = exporters.map((name) => ({
    name,
    displayName: getAgentDisplayName(name),
    detected: detection.detected.includes(name),
  }));

  const detectedButNotConfigured: ExporterStatus[] = detection.missing.map(
    (name) => ({
      name,
      displayName: getAgentDisplayName(name),
      detected: true,
    }),
  );

  const configuredButMissing: ExporterStatus[] = detection.notFound.map(
    (name) => ({
      name,
      displayName: getAgentDisplayName(name),
      detected: false,
    }),
  );

  const lastSyncTimestamp = getLastSyncTimestamp(cwd);
  const lastSync = {
    timestamp: lastSyncTimestamp,
    label: formatLastSyncLabel(lastSyncTimestamp),
    ...(lastSyncTimestamp
      ? { relative: formatRelativeTimestamp(lastSyncTimestamp) }
      : {}),
    ...(lastSyncTimestamp
      ? { iso: new Date(lastSyncTimestamp).toISOString() }
      : {}),
    filePath: resolve(cwd, ".aligntrue", ".last-sync"),
  };

  const lockfileEnabled = config.modules?.lockfile === true;
  const bundleEnabled = config.modules?.bundle === true;

  const lockfile = {
    enabled: lockfileEnabled,
    mode: config.lockfile?.mode || (lockfileEnabled ? "soft" : "off"),
    exists: existsSync(paths.lockfile),
    path: paths.lockfile,
  };

  const bundle = {
    enabled: bundleEnabled,
    exists: existsSync(paths.bundle),
    path: paths.bundle,
  };

  const workflowMode = config.sync?.workflow_mode || "auto";
  const editSources = normalizeEditSources(config.sync?.edit_source);
  const autoPullEnabled =
    config.sync?.auto_pull === undefined
      ? true
      : Boolean(config.sync.auto_pull);

  return {
    mode: config.mode,
    configPath,
    cwd,
    lastSync,
    exporters: {
      configured,
      detectedButNotConfigured,
      configuredButMissing,
    },
    sync: {
      workflowMode,
      editSources,
      autoPull: {
        enabled: autoPullEnabled,
        primaryAgent: config.sync?.primary_agent || null,
      },
      primaryAgent: config.sync?.primary_agent || null,
    },
    lockfile,
    bundle,
  };
}

/**
 * Human-readable renderer
 */
function renderStatus(summary: StatusSummary): void {
  clack.intro("AlignTrue Status");

  console.log(`\nMode: ${summary.mode?.toUpperCase() || "UNKNOWN"}`);
  console.log(`Config: ${summary.configPath}`);
  console.log(`Last sync: ${summary.lastSync.label}`);

  console.log(
    `\nExporters (${summary.exporters.configured.length} configured):`,
  );
  if (summary.exporters.configured.length === 0) {
    console.log("  (none configured - run 'aligntrue adapters enable <name>')");
  } else {
    for (const exporter of summary.exporters.configured) {
      const icon = exporter.detected ? "✓" : "⚠";
      const note = exporter.detected ? "" : " - files not detected";
      console.log(
        `  ${icon} ${exporter.displayName} (${exporter.name})${note}`,
      );
    }
  }

  if (summary.exporters.detectedButNotConfigured.length > 0) {
    const names = summary.exporters.detectedButNotConfigured
      .map((e) => e.displayName)
      .join(", ");
    clack.log.info(
      `Detected agent files not yet enabled: ${names}\n  → Run 'aligntrue adapters enable <name>'`,
    );
  }

  if (summary.exporters.configuredButMissing.length > 0) {
    const names = summary.exporters.configuredButMissing
      .map((e) => e.displayName)
      .join(", ");
    clack.log.warn(
      `Configured exporters missing files: ${names}\n  → Create their files or disable the exporter`,
    );
  }

  console.log("\nSync settings:");
  console.log(`  Workflow: ${summary.sync.workflowMode}`);
  console.log(
    `  Edit sources: ${summary.sync.editSources
      .map((src) => src.label)
      .join(", ")}`,
  );

  const autoPull = summary.sync.autoPull;
  const autoPullDetail = autoPull.enabled
    ? `enabled${autoPull.primaryAgent ? ` (pulling from ${autoPull.primaryAgent})` : ""}`
    : "disabled";
  console.log(`  Auto-pull: ${autoPullDetail}`);

  if (!autoPull.enabled && summary.sync.primaryAgent) {
    console.log(`  Primary agent: ${summary.sync.primaryAgent}`);
  }

  console.log("\nLockfile:");
  if (summary.lockfile.enabled) {
    console.log(`  Status: enabled (${summary.lockfile.mode})`);
    console.log(
      `  File: ${summary.lockfile.exists ? "present" : "missing (run 'aligntrue sync')"}`,
    );
  } else {
    console.log("  Status: disabled");
  }

  console.log("\nBundle:");
  if (summary.bundle.enabled) {
    console.log(
      `  File: ${summary.bundle.exists ? "present" : "missing (run 'aligntrue sync')"}`,
    );
  } else {
    console.log("  Status: disabled");
  }

  clack.outro("Status displayed");
}

/**
 * Format last sync label with fallback
 */
function formatLastSyncLabel(timestamp: number | null): string {
  if (!timestamp) {
    return "Never synced (run 'aligntrue sync')";
  }
  const absolute = new Date(timestamp).toLocaleString();
  const relative = formatRelativeTimestamp(timestamp);
  return `${absolute} (${relative})`;
}

/**
 * Friendly relative time helper
 */
function formatRelativeTimestamp(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const thresholds: Array<{
    limit: number;
    unit: Intl.RelativeTimeFormatUnit;
  }> = [
    { limit: 60_000, unit: "second" },
    { limit: 3_600_000, unit: "minute" },
    { limit: 86_400_000, unit: "hour" },
    { limit: Number.POSITIVE_INFINITY, unit: "day" },
  ];

  if (Math.abs(diffMs) < 5_000) {
    return "just now";
  }

  for (const { limit, unit } of thresholds) {
    if (Math.abs(diffMs) < limit) {
      const divisor =
        unit === "second"
          ? 1_000
          : unit === "minute"
            ? 60_000
            : unit === "hour"
              ? 3_600_000
              : 86_400_000;
      const value = Math.round(diffMs / divisor);
      const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
      return rtf.format(value * -1, unit);
    }
  }

  return "some time ago";
}

/**
 * Normalize edit_source to an array with friendly labels
 */
function normalizeEditSources(
  editSource: string | string[] | undefined,
): EditSourceSummary[] {
  if (!editSource || (Array.isArray(editSource) && editSource.length === 0)) {
    return [{ raw: "AGENTS.md", label: "AGENTS.md" }];
  }

  const sources = Array.isArray(editSource) ? editSource : [editSource];
  return sources.map((raw) => ({
    raw,
    label: formatEditSourceLabel(raw),
  }));
}

/**
 * Human-friendly label for edit sources
 */
function formatEditSourceLabel(raw: string): string {
  if (raw === "any_agent_file") {
    return "Any agent file (two-way sync)";
  }
  if (raw === ".rules.yaml" || raw === ".aligntrue/.rules.yaml") {
    return ".aligntrue/.rules.yaml (internal IR)";
  }
  if (raw === ".cursor/rules/*.mdc") {
    return "Cursor .mdc files (.cursor/rules/*.mdc)";
  }
  return raw;
}
