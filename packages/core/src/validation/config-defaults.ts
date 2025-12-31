import type { AlignTrueConfig, ExporterConfig } from "../config/types.js";

function getExporterCount(
  exporters: string[] | Record<string, ExporterConfig> | undefined,
): number {
  if (!exporters) return 0;
  if (Array.isArray(exporters)) return exporters.length;
  return Object.keys(exporters).length;
}

export function applyDefaults(config: AlignTrueConfig): AlignTrueConfig {
  const result: AlignTrueConfig = { ...config };

  if (!result.mode) {
    if (
      result.exporters &&
      getExporterCount(result.exporters) > 0 &&
      !result.modules?.lockfile
    ) {
      result.mode = "solo";
    } else if (result.modules?.lockfile) {
      result.mode = "team";
    } else {
      result.mode = "solo";
    }
  }

  if (!result.version) {
    result.version = "1";
  }

  if (!result.modules) {
    result.modules = {};
  }

  if (result.mode === "solo") {
    result.modules.lockfile = result.modules.lockfile ?? false;
    result.modules.checks = result.modules.checks ?? true;
    result.modules.mcp = result.modules.mcp ?? false;
  } else if (result.mode === "team") {
    result.modules.lockfile = result.modules.lockfile ?? true;
    result.modules.checks = result.modules.checks ?? true;
    result.modules.mcp = result.modules.mcp ?? false;
  } else if (result.mode === "enterprise") {
    result.modules.lockfile = result.modules.lockfile ?? true;
    result.modules.checks = result.modules.checks ?? true;
    result.modules.mcp = result.modules.mcp ?? true;
  }

  if (!result.git) {
    result.git = {};
  }

  if (result.mode === "solo" || result.mode === "team") {
    result.git.mode = result.git.mode ?? "ignore";
  } else if (result.mode === "enterprise") {
    result.git.mode = result.git.mode ?? "commit";
  }

  result.git.branch_check_interval = result.git.branch_check_interval ?? 86400;
  result.git.tag_check_interval = result.git.tag_check_interval ?? 604800;
  result.git.offline_fallback = result.git.offline_fallback ?? true;
  result.git.auto_gitignore = result.git.auto_gitignore ?? "auto";

  if (!result.sync) {
    result.sync = {};
  }

  if (!result.exporters || result.exporters.length === 0) {
    result.exporters = ["cursor", "agents"];
  }

  if (!result.sources || result.sources.length === 0) {
    result.sources = [{ type: "local", path: ".aligntrue/rules" }];
  }

  if (!result.performance) {
    result.performance = {};
  }
  result.performance.max_file_size_mb =
    result.performance.max_file_size_mb ?? 10;
  result.performance.max_directory_depth =
    result.performance.max_directory_depth ?? 10;
  result.performance.ignore_patterns = result.performance.ignore_patterns ?? [];

  if (!result.backup) {
    result.backup = {};
  }
  result.backup.retention_days = result.backup.retention_days ?? 30;
  if (result.backup.retention_days < 0) result.backup.retention_days = 0;
  result.backup.minimum_keep = result.backup.minimum_keep ?? 3;
  if (result.backup.minimum_keep < 1) result.backup.minimum_keep = 1;

  if (!result.detection) {
    result.detection = {};
  }
  result.detection.auto_enable = result.detection.auto_enable ?? false;
  result.detection.ignored_agents = result.detection.ignored_agents ?? [];

  return result;
}
