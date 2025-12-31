import {
  validateScopePath,
  validateGlobPatterns,
  validateMergeOrder,
} from "../scope.js";
import { parseSourceURL } from "../sources/url-parser.js";
import type {
  AlignTrueConfig,
  AlignTrueMode,
  ModeHints,
} from "../config/types.js";

export const shownWarnings = new Set<string>();

export function checkUnknownFields(
  config: Record<string, unknown>,
  configPath: string,
): void {
  const knownFields = new Set([
    "version",
    "mode",
    "modules",
    "lockfile",
    "git",
    "sync",
    "managed",
    "sources",
    "exporters",
    "scopes",
    "merge",
    "performance",
    "export",
    "backup",
    "remotes",
    "detection",
    "overlays",
    "plugs",
    "mcp",
  ]);

  for (const key of Object.keys(config)) {
    if (key.startsWith("vendor.")) continue;

    if (!knownFields.has(key)) {
      const warningKey = `unknown-field:${configPath}:${key}`;
      if (shownWarnings.has(warningKey)) {
        continue;
      }
      shownWarnings.add(warningKey);
      console.warn(
        `Warning: Unrecognized config field "${key}" in ${configPath}\n` +
          `\n` +
          `This field will be ignored. Did you mean one of these?\n` +
          `  - Common fields: version, mode, sync, sources, exporters\n` +
          `  - Vendor fields: vendor.${key} (for custom/third-party integrations)\n` +
          `\n` +
          `Valid fields: ${Array.from(knownFields).join(", ")}\n` +
          `Run 'aligntrue config list' to see all recognized fields`,
      );
    }
  }
}

export function expandSourcesWithInclude(
  sources: NonNullable<AlignTrueConfig["sources"]>,
): NonNullable<AlignTrueConfig["sources"]> {
  const expanded: NonNullable<AlignTrueConfig["sources"]> = [];

  for (const source of sources) {
    if (!source) continue;

    const sourceWithInclude = source as {
      type?: string;
      include?: string[];
      url?: string;
      path?: string;
      ref?: string;
    };

    if (sourceWithInclude.type === "git" && sourceWithInclude.include) {
      for (const includeUrl of sourceWithInclude.include) {
        try {
          const parsed = parseSourceURL(includeUrl);
          const expandedSource: {
            type: "git" | "local";
            url?: string;
            path?: string;
            ref?: string;
          } = {
            type: "git",
            url: `https://${parsed.host}/${parsed.org}/${parsed.repo}`,
          };
          if (parsed.ref) {
            expandedSource.ref = parsed.ref;
          }
          if (parsed.path) {
            expandedSource.path = parsed.path;
          }
          expanded.push(
            expandedSource as NonNullable<AlignTrueConfig["sources"]>[0],
          );
        } catch (error) {
          throw new Error(
            `Failed to parse include URL: ${includeUrl}\n` +
              `  ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } else {
      expanded.push(source);
    }
  }

  return expanded;
}

export async function validateConfig(
  config: AlignTrueConfig,
  configPath?: string,
): Promise<void> {
  const validModes: AlignTrueMode[] = ["solo", "team", "enterprise"];
  if (!validModes.includes(config.mode)) {
    throw new Error(
      `Invalid mode "${config.mode}": must be one of ${validModes.join(", ")}`,
    );
  }

  if (configPath) {
    checkUnknownFields(
      config as unknown as Record<string, unknown>,
      configPath,
    );
  }

  if (config.modules) {
    for (const [key, value] of Object.entries(config.modules)) {
      if (typeof value !== "boolean" && value !== undefined) {
        throw new Error(
          `Invalid modules.${key}: must be boolean, got ${typeof value}`,
        );
      }
    }
  }

  if (config.sources && Array.isArray(config.sources)) {
    for (let i = 0; i < config.sources.length; i++) {
      const source = config.sources[i];
      if (!source || typeof source !== "object") {
        throw new Error(`Invalid source at index ${i}: must be an object`);
      }

      if (source.type === "local" && !source.path) {
        throw new Error(
          `Invalid source at index ${i}: "path" is required for type "local"`,
        );
      } else if (source.type === "git" && source.include) {
        continue;
      } else if (source.type === "git" && !source.url) {
        throw new Error(
          `Invalid source at index ${i}: "url" is required for type "git"`,
        );
      }

      if (source.type === "local" && source.path) {
        try {
          validateScopePath(source.path);
        } catch (_err) {
          throw new Error(
            `Invalid source at index ${i}: ${_err instanceof Error ? _err.message : String(_err)}`,
          );
        }
      }
    }
  }

  if (config.exporters) {
    const MAX_EXPORTERS = 20;
    const VALID_FORMATS = ["native", "agents-md"] as const;
    const MULTI_FORMAT_AGENTS = new Set([
      "cursor",
      "amazonq",
      "kilocode",
      "augmentcode",
      "kiro",
      "trae-ai",
    ]);

    if (Array.isArray(config.exporters)) {
      if (config.exporters.length > MAX_EXPORTERS) {
        throw new Error(
          `Too many exporters configured (${config.exporters.length}). Maximum allowed is ${MAX_EXPORTERS}.`,
        );
      }

      const uniqueExporters = new Set(config.exporters);
      if (uniqueExporters.size !== config.exporters.length) {
        const seen = new Set();
        const duplicates = new Set();
        for (const exporter of config.exporters) {
          if (seen.has(exporter)) {
            duplicates.add(exporter);
          }
          seen.add(exporter);
        }
        throw new Error(
          `Duplicate exporters found: ${Array.from(duplicates).join(", ")}`,
        );
      }

      for (let i = 0; i < config.exporters.length; i++) {
        const exporter = config.exporters[i];
        if (typeof exporter !== "string" || exporter.trim() === "") {
          throw new Error(
            `Invalid exporter at index ${i}: must be non-empty string`,
          );
        }
      }
    } else if (typeof config.exporters === "object") {
      const exporterNames = Object.keys(config.exporters);

      if (exporterNames.length > MAX_EXPORTERS) {
        throw new Error(
          `Too many exporters configured (${exporterNames.length}). Maximum allowed is ${MAX_EXPORTERS}.`,
        );
      }

      for (const [name, exporterConfig] of Object.entries(config.exporters)) {
        if (name.trim() === "") {
          throw new Error(`Invalid exporter name: must be non-empty string`);
        }

        if (exporterConfig && typeof exporterConfig === "object") {
          const format = (exporterConfig as { format?: string }).format;
          if (format !== undefined) {
            if (
              !VALID_FORMATS.includes(format as (typeof VALID_FORMATS)[number])
            ) {
              const warningKey = `invalid-format-${name}`;
              if (!shownWarnings.has(warningKey)) {
                shownWarnings.add(warningKey);
                console.warn(
                  `Warning: Invalid format "${format}" for exporter "${name}". ` +
                    `Valid options: ${VALID_FORMATS.join(", ")}. Using default "native".`,
                );
              }
            }

            if (format === "agents-md" && !MULTI_FORMAT_AGENTS.has(name)) {
              // Allow with warning handled by exporters
            } else if (format === "native" && !MULTI_FORMAT_AGENTS.has(name)) {
              // Allow with warning handled by exporters
            }
          }
        }
      }
    }
  }

  if (config.scopes && Array.isArray(config.scopes)) {
    for (let i = 0; i < config.scopes.length; i++) {
      const scope = config.scopes[i];
      if (!scope) {
        throw new Error(
          `Invalid scope at index ${i}: scope is null or undefined`,
        );
      }

      if (!scope.path || typeof scope.path !== "string") {
        throw new Error(
          `Invalid scope at index ${i}: missing or invalid "path" field`,
        );
      }

      try {
        validateScopePath(scope.path);
      } catch (_err) {
        throw new Error(
          `Invalid scope at index ${i}: ${_err instanceof Error ? _err.message : String(_err)}`,
        );
      }

      try {
        validateGlobPatterns(scope.include);
      } catch (_err) {
        throw new Error(
          `Invalid scope at index ${i}, include patterns: ${_err instanceof Error ? _err.message : String(_err)}`,
        );
      }

      try {
        validateGlobPatterns(scope.exclude);
      } catch (_err) {
        throw new Error(
          `Invalid scope at index ${i}, exclude patterns: ${_err instanceof Error ? _err.message : String(_err)}`,
        );
      }

      if (scope.rulesets !== undefined) {
        if (!Array.isArray(scope.rulesets)) {
          throw new Error(
            `Invalid scope at index ${i}: "rulesets" must be an array`,
          );
        }
        for (const ruleset of scope.rulesets) {
          if (typeof ruleset !== "string") {
            throw new Error(
              `Invalid scope at index ${i}: ruleset IDs must be strings`,
            );
          }
        }
      }
    }

    if (config.scopes.length === 0) {
      console.warn(
        `Warning: "scopes" array is defined but empty. Consider removing it or adding scope definitions.`,
      );
    }
  }

  if (config.merge?.order) {
    try {
      validateMergeOrder(config.merge.order);
    } catch (_err) {
      throw new Error(
        `Invalid merge order: ${_err instanceof Error ? _err.message : String(_err)}`,
      );
    }
  }

  if (config.git?.mode) {
    const validGitModes = ["ignore", "commit", "branch"];
    if (!validGitModes.includes(config.git.mode)) {
      throw new Error(
        `Invalid git mode "${config.git.mode}": must be one of ${validGitModes.join(", ")}`,
      );
    }
  }

  if (config.mode === "solo" && config.modules?.lockfile === true) {
    const warningKey = "solo-lockfile-mismatch";
    if (!shownWarnings.has(warningKey)) {
      shownWarnings.add(warningKey);
      console.warn(
        `Warning: Solo mode with lockfile enabled is unusual.\n` +
          `  Consider using 'mode: team' if you need lockfile features.`,
      );
    }
  }
}

export function getModeHints(
  exporterName: string,
  config: AlignTrueConfig,
): ModeHints {
  if (exporterName === "cursor" || exporterName === "yaml") {
    return "native";
  }

  const override = config.export?.mode_hints?.overrides?.[exporterName];
  if (override) {
    return override;
  }

  return config.export?.mode_hints?.default ?? "metadata_only";
}

export function isValidConfigKey(key: string): boolean {
  const validKeys = new Set([
    "version",
    "mode",
    "modules",
    "modules.lockfile",
    "modules.checks",
    "modules.mcp",
    "lockfile",
    "lockfile.mode",
    "git",
    "git.mode",
    "git.branch_check_interval",
    "git.tag_check_interval",
    "git.offline_fallback",
    "git.auto_gitignore",
    "sync",
    "sources",
    "exporters",
    "scopes",
    "merge",
    "merge.strategy",
    "merge.order",
    "performance",
    "performance.max_file_size_mb",
    "performance.max_directory_depth",
    "performance.ignore_patterns",
    "export",
    "export.mode_hints",
    "export.max_hint_blocks",
    "export.max_hint_tokens",
    "backup",
    "backup.retention_days",
    "backup.minimum_keep",
    "remotes",
    "remotes.personal",
    "remotes.shared",
    "remotes.custom",
    "detection",
    "detection.auto_enable",
    "detection.ignored_agents",
    "overlays",
    "plugs",
    "plugs.fills",
    "mcp",
    "mcp.servers",
  ]);

  if (key.startsWith("vendor.")) {
    return true;
  }

  if (validKeys.has(key)) {
    return true;
  }

  const parts = key.split(".");
  for (let i = parts.length - 1; i > 0; i--) {
    const parentKey = parts.slice(0, i).join(".");
    if (validKeys.has(parentKey)) {
      return true;
    }
  }

  if (key.startsWith("resources.")) {
    return true;
  }

  if (key.startsWith("storage.")) {
    return true;
  }

  return false;
}

export function resetShownWarnings(): void {
  shownWarnings.clear();
}
