/**
 * Doctor command - Run health checks against AlignTrue workspace
 */

import { existsSync, statSync } from "fs";
import { resolve, relative as relativePath } from "path";
import * as clack from "@clack/prompts";
import { globSync } from "glob";
import {
  getAlignTruePaths,
  loadConfig,
  type AlignTrueConfig,
} from "@aligntrue/core";
import { resolveConfigPath } from "../utils/path-resolvers.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import {
  detectAgentsWithValidation,
  getAgentDisplayName,
} from "../utils/detect-agents.js";
import { loadExporterManifests } from "../utils/exporter-validation.js";
import type { AdapterManifest } from "@aligntrue/plugin-contracts";

type CheckStatus = "ok" | "warn" | "error";

interface DoctorCheck {
  id: string;
  label: string;
  status: CheckStatus;
  details?: string[];
  hint?: string;
}

interface DoctorReport {
  cwd: string;
  configPath: string;
  checks: DoctorCheck[];
  summary: {
    ok: number;
    warn: number;
    error: number;
  };
}

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
    description: "Output doctor report in JSON format",
  },
  {
    flag: "--help",
    alias: "-h",
    hasValue: false,
    description: "Show this help message",
  },
];

/**
 * Entry point
 */
export async function doctor(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help) {
    showStandardHelp({
      name: "doctor",
      description:
        "Run health checks to verify config, rules, exporters, and team safeguards",
      usage: "aligntrue doctor [options]",
      args: ARG_DEFINITIONS,
      examples: ["aligntrue doctor", "aligntrue doctor --json"],
      notes: [
        "Checks:",
        "  ✓ Config file exists and loads",
        "  ✓ Rules IR file present",
        "  ✓ Exporter outputs exist",
        "  ✓ Lockfile/bundle presence when enabled",
        "  ✓ Agent detection vs configured exporters",
      ],
    });
    return;
  }

  const cwd = process.cwd();
  const configPath = resolveConfigPath(
    parsed.flags["config"] as string | undefined,
    cwd,
  );

  const report = await runDoctor(cwd, configPath);
  const asJson = Boolean(parsed.flags["json"]);

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    renderDoctor(report);
  }

  if (report.summary.error > 0) {
    process.exit(1);
  }
}

/**
 * Execute health checks
 */
async function runDoctor(
  cwd: string,
  configPath: string,
): Promise<DoctorReport> {
  const paths = getAlignTruePaths(cwd);
  const checks: DoctorCheck[] = [];
  const relativeConfig = formatRelative(configPath, cwd);

  // Config file presence
  const hasConfig = existsSync(configPath);
  checks.push({
    id: "config.exists",
    label: `Config file (${relativeConfig})`,
    status: hasConfig ? "ok" : "error",
    ...(hasConfig ? {} : { hint: "Run 'aligntrue init' to create it" }),
  });

  let config: AlignTrueConfig | null = null;
  if (hasConfig) {
    try {
      config = await loadConfig(configPath, cwd);
      checks.push({
        id: "config.valid",
        label: `Config valid (mode: ${config.mode})`,
        status: "ok",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      checks.push({
        id: "config.valid",
        label: "Config validation",
        status: "error",
        details: message.split("\n"),
        hint: "Fix the config file and rerun 'aligntrue doctor'",
      });
    }
  }

  // Rules file
  const rulesPath = resolveRulesPath(config, cwd, paths.rules);
  const rulesRelative = formatRelative(rulesPath, cwd);
  if (existsSync(rulesPath)) {
    const stats = safeStat(rulesPath);
    const sizeOk = stats ? stats.size > 0 : false;
    checks.push({
      id: "rules.exists",
      label: `Rules file (${rulesRelative})`,
      status: sizeOk ? "ok" : "warn",
      ...(sizeOk
        ? {}
        : { hint: "File is empty. Run 'aligntrue sync' to regenerate" }),
    });
  } else {
    checks.push({
      id: "rules.exists",
      label: `Rules file (${rulesRelative})`,
      status: "error",
      hint: "Run 'aligntrue sync' to regenerate .aligntrue/rules/",
    });
  }

  // Lockfile
  if (config?.modules?.lockfile) {
    const lockfileExists = existsSync(paths.lockfile);
    checks.push({
      id: "lockfile.exists",
      label: `Lockfile (.aligntrue.lock.json)`,
      status: lockfileExists ? "ok" : "error",
      ...(lockfileExists
        ? {}
        : {
            hint: "Required in team mode. Run 'aligntrue sync' to regenerate",
          }),
    });
  }

  // Bundle
  if (config?.modules?.bundle) {
    const bundleExists = existsSync(paths.bundle);
    checks.push({
      id: "bundle.exists",
      label: `Bundle (.aligntrue.bundle.yaml)`,
      status: bundleExists ? "ok" : "warn",
      ...(bundleExists
        ? {}
        : { hint: "Run 'aligntrue sync' to regenerate bundle" }),
    });
  }

  // Exporter outputs
  if (config?.exporters && config.exporters.length > 0) {
    let manifestMap: Map<string, AdapterManifest> | null = null;
    try {
      manifestMap = await loadExporterManifests();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      checks.push({
        id: "exporters.manifests",
        label: "Exporter metadata",
        status: "warn",
        details: [message],
        hint: "Reinstall AlignTrue or run 'pnpm build' to regenerate exporters",
      });
    }

    for (const exporterName of config.exporters) {
      const manifest = manifestMap?.get(exporterName);
      if (!manifest) {
        checks.push({
          id: `exporter.${exporterName}`,
          label: `Exporter: ${exporterName}`,
          status: "warn",
          hint: "Unknown exporter. Run 'aligntrue adapters list' to verify name",
        });
        continue;
      }
      checks.push(evaluateExporter(exporterName, manifest, cwd));
    }
  } else {
    checks.push({
      id: "exporters.none",
      label: "Exporters configured",
      status: "warn",
      hint: "No exporters enabled. Run 'aligntrue adapters enable <adapter>'",
    });
  }

  // Detection vs config
  if (config) {
    const detection = detectAgentsWithValidation(cwd, config.exporters ?? []);
    if (detection.missing.length > 0) {
      const names = detection.missing
        .map((name) => getAgentDisplayName(name))
        .join(", ");
      checks.push({
        id: "detection.unconfigured",
        label: "Detected agent files not configured",
        status: "warn",
        details: [names],
        hint: "Run 'aligntrue adapters enable <name>' to add them",
      });
    }
    if (detection.notFound.length > 0) {
      const names = detection.notFound
        .map((name) => getAgentDisplayName(name))
        .join(", ");
      checks.push({
        id: "detection.missing",
        label: "Configured exporters missing files",
        status: "warn",
        details: [names],
        hint: "Run 'aligntrue sync' to regenerate exporter outputs",
      });
    }
  }

  return {
    cwd,
    configPath,
    checks,
    summary: summarize(checks),
  };
}

/**
 * Pretty rendering
 */
function renderDoctor(report: DoctorReport): void {
  clack.intro("AlignTrue Health Check");

  for (const check of report.checks) {
    const icon =
      check.status === "ok" ? "✓" : check.status === "warn" ? "⚠" : "✗";
    console.log(`${icon} ${check.label}`);
    if (check.details) {
      for (const line of check.details) {
        console.log(`    ${line}`);
      }
    }
    if (check.hint) {
      console.log(`    → ${check.hint}`);
    }
  }

  const { ok, warn, error } = report.summary;
  const summaryLine = `Checks: ${ok} ok, ${warn} warning${warn === 1 ? "" : "s"}, ${error} error${error === 1 ? "" : "s"}`;
  console.log("\n" + summaryLine + "\n");

  if (error > 0) {
    clack.outro("✗ Issues detected. See above for remediation steps.");
  } else if (warn > 0) {
    clack.outro("⚠ All critical checks passed, but warnings remain.");
  } else {
    clack.outro("✓ All systems go");
  }
}

/**
 * Evaluate exporter outputs
 */
function evaluateExporter(
  name: string,
  manifest: AdapterManifest,
  cwd: string,
): DoctorCheck {
  const outputs = manifest.outputs || [];
  if (outputs.length === 0) {
    return {
      id: `exporter.${name}`,
      label: `Exporter: ${getAgentDisplayName(name)}`,
      status: "warn",
      hint: "Exporter manifest missing outputs definition",
    };
  }

  const missing: string[] = [];
  const foundDetails: string[] = [];

  for (const pattern of outputs) {
    const result = checkOutputPattern(pattern, cwd);
    if (result.exists) {
      const countInfo =
        typeof result.count === "number"
          ? ` (${result.count} match${result.count === 1 ? "" : "es"})`
          : "";
      foundDetails.push(`✓ ${pattern}${countInfo}`);
    } else {
      missing.push(pattern);
      foundDetails.push(`✗ ${pattern}`);
    }
  }

  return {
    id: `exporter.${name}`,
    label: `Exporter: ${getAgentDisplayName(name)} (${name})`,
    status: missing.length === 0 ? "ok" : "warn",
    details: foundDetails,
    ...(missing.length === 0
      ? {}
      : {
          hint: "Run 'aligntrue sync' to regenerate missing exporter outputs",
        }),
  };
}

/**
 * Check file/directory for an exporter output pattern
 */
function checkOutputPattern(
  pattern: string,
  cwd: string,
): { exists: boolean; count?: number } {
  const normalized = pattern.replace(/\\/g, "/");

  if (normalized.endsWith("/")) {
    const dirPath = resolve(cwd, normalized);
    try {
      const stats = statSync(dirPath);
      return { exists: stats.isDirectory() };
    } catch {
      return { exists: false };
    }
  }

  try {
    const matches = globSync(pattern, {
      cwd,
      dot: true,
      absolute: false,
      nodir: false,
    });
    return { exists: matches.length > 0, count: matches.length };
  } catch {
    return { exists: false };
  }
}

function safeStat(path: string): { size: number } | null {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function summarize(checks: DoctorCheck[]) {
  const summary = { ok: 0, warn: 0, error: 0 };
  for (const check of checks) {
    if (check.status === "ok") summary.ok++;
    else if (check.status === "warn") summary.warn++;
    else summary.error++;
  }
  return summary;
}

function resolveRulesPath(
  config: AlignTrueConfig | null,
  cwd: string,
  defaultPath: string,
): string {
  const candidate =
    config?.sources &&
    config.sources.length > 0 &&
    config.sources[0]?.type === "local"
      ? config.sources[0]?.path
      : undefined;
  if (candidate) {
    return resolve(cwd, candidate);
  }
  return defaultPath;
}

function formatRelative(target: string, cwd: string): string {
  const rel = relativePath(cwd, target);
  return rel && !rel.startsWith("..") ? rel || "." : target;
}
