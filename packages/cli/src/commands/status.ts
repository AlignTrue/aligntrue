/**
 * Status command - Display workspace health at a glance
 */

import { existsSync, readdirSync } from "fs";
import { resolve, join } from "path";
import * as clack from "@clack/prompts";
import {
  getAlignTruePaths,
  loadConfig,
  type AlignTrueConfig,
  getExporterNames,
} from "@aligntrue/core";
import { resolveConfigPath } from "../utils/path-resolvers.js";
import { getLastSyncTimestamp } from "@aligntrue/core/sync/tracking";
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
  rules: {
    directory: string;
    count: number;
    files: string[];
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
        "and lockfile/bundle state.",
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
 * Build a normalized status summary
 */
function buildStatusSummary(
  config: AlignTrueConfig,
  configPath: string,
  cwd: string,
): StatusSummary {
  const paths = getAlignTruePaths(cwd);
  const exporters = getExporterNames(config.exporters);
  const detection = detectAgentsWithValidation(cwd, exporters);

  const configured: ExporterStatus[] = exporters.map((name: string) => ({
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

  // Count rule files in .aligntrue/rules/ (recursively)
  const rulesDir = resolve(cwd, ".aligntrue/rules");
  let rulesCount = 0;
  let ruleFiles: string[] = [];
  if (existsSync(rulesDir)) {
    try {
      ruleFiles = listMarkdownFilesRecursively(rulesDir);
      rulesCount = ruleFiles.length;
    } catch {
      // Ignore errors, just show 0
    }
  }

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
    rules: {
      directory: rulesDir,
      count: rulesCount,
      files: ruleFiles,
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
      `Detected agent files not yet enabled: ${names}\n  → Run 'aligntrue adapters enable <name>'\n  → View all adapters: aligntrue adapters list\n  → Don't see yours? https://aligntrue.ai/docs/06-contributing/adding-exporters`,
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

  console.log("\nRules:");
  console.log(`  Directory: ${summary.rules.directory}`);
  if (summary.rules.files.length > 0) {
    console.log(`  Files: ${summary.rules.count} .md file(s)`);
    for (const file of summary.rules.files) {
      console.log(`    - ${file}`);
    }
  } else {
    console.log(`  Files: ${summary.rules.count} .md file(s)`);
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
 * List markdown files recursively in a directory
 */
function listMarkdownFilesRecursively(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = listMarkdownFilesRecursively(fullPath);
      files.push(...subFiles.map((f) => join(entry.name, f)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(entry.name);
    }
  }

  return files.sort();
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
