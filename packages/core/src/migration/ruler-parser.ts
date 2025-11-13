/**
 * Ruler config parser and converter
 * Converts Ruler's ruler.toml to AlignTrue config
 */

import { readFileSync } from "fs";
import type { AlignTrueConfig } from "../config/index.js";

// Note: @iarna/toml needs to be added as a dependency
// For now, using a simple TOML parser implementation
// TODO: Add @iarna/toml to dependencies

export interface RulerConfig {
  nested?: boolean;
  gitignore?: {
    enabled?: boolean;
  };
  agents?: Record<
    string,
    {
      enabled?: boolean;
    }
  >;
  mcp?: {
    servers?: Record<string, Record<string, unknown>>;
  };
}

/**
 * Parse ruler.toml file
 * Simple TOML parser for basic Ruler config structure
 */
export function parseRulerToml(path: string): RulerConfig {
  const content = readFileSync(path, "utf-8");

  // Simple TOML parsing for Ruler's structure
  // This handles the basic cases we need for migration
  const config: RulerConfig = {};

  let currentSection: string | null = null;
  let currentSubsection: string | null = null;

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // Section headers
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const section = trimmed.slice(1, -1);

      if (section.includes(".")) {
        // Subsection like [agents.cursor]
        const parts = section.split(".");
        currentSection = parts[0] || null;
        currentSubsection = parts.slice(1).join(".") || null;
      } else {
        // Top-level section like [gitignore]
        currentSection = section;
        currentSubsection = null;
      }
      continue;
    }

    // Key-value pairs
    const match = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (match) {
      const key = match[1];
      const rawValue = match[2]?.trim() ?? "";
      let value: string | number | boolean = rawValue;

      // Parse value types
      if (rawValue === "true") {
        value = true;
      } else if (rawValue === "false") {
        value = false;
      } else if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
        value = rawValue.slice(1, -1);
      } else if (!isNaN(Number(rawValue))) {
        value = Number(rawValue);
      }

      // Store in config
      if (!currentSection) {
        // Top-level key
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (config as any)[key!] = value;
      } else if (currentSubsection) {
        // Nested key like agents.cursor.enabled
        if (!config[currentSection as keyof RulerConfig]) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (config as any)[currentSection] = {};
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const section = (config as any)[currentSection];
        if (!section[currentSubsection]) {
          section[currentSubsection] = {};
        }
        section[currentSubsection][key!] = value;
      } else {
        // Section-level key like gitignore.enabled
        if (!config[currentSection as keyof RulerConfig]) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (config as any)[currentSection] = {};
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (config as any)[currentSection][key!] = value;
      }
    }
  }

  return config;
}

/**
 * Convert Ruler config to AlignTrue config
 */
export function convertRulerConfig(
  rulerConfig: RulerConfig,
): Partial<AlignTrueConfig> {
  const config: Partial<AlignTrueConfig> = {
    mode: "solo",
    exporters: [],
  };

  // Convert enabled agents
  if (rulerConfig.agents) {
    for (const [agent, settings] of Object.entries(rulerConfig.agents)) {
      if (settings.enabled !== false) {
        config.exporters!.push(agent);
      }
    }
  }

  // Convert nested to scopes (if we find nested .ruler dirs)
  // This will be populated by discovery during migration
  if (rulerConfig.nested) {
    config.scopes = [];
  }

  // Convert gitignore setting
  if (rulerConfig.gitignore?.enabled !== undefined) {
    config.git = {
      auto_gitignore: rulerConfig.gitignore.enabled ? "always" : "never",
    };
  }

  return config;
}
