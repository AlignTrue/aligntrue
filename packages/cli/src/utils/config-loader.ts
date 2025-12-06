/**
 * Unified config loader with standardized error handling
 *
 * This utility consolidates config loading logic across all CLI commands,
 * ensuring consistent error messages and user experience.
 */

import { loadConfig, type AlignTrueConfig } from "@aligntrue/core";
import * as clack from "@clack/prompts";
import { existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { exitWithError } from "./command-utilities.js";

function hasPartialState(cwd: string): {
  hasBackups: boolean;
  hasCache: boolean;
} {
  const aligntrueDir = join(cwd, ".aligntrue");
  return {
    hasBackups: existsSync(join(aligntrueDir, ".backups")),
    hasCache:
      existsSync(join(aligntrueDir, ".cache")) ||
      existsSync(join(aligntrueDir, ".last-sync")),
  };
}

/**
 * Load and validate AlignTrue configuration with standardized error handling
 *
 * @param configPath - Path to config file (default: .aligntrue/config.yaml)
 * @returns Validated configuration object
 * @throws Exits process with code 2 on validation failure
 *
 * @example
 * ```typescript
 * const config = await loadConfigWithValidation('.aligntrue/config.yaml')
 * ```
 */
export async function loadConfigWithValidation(
  configPath: string = ".aligntrue/config.yaml",
): Promise<AlignTrueConfig> {
  try {
    const config = await loadConfig(configPath);
    return config;
  } catch (_error) {
    const errno = _error as NodeJS.ErrnoException;

    // Let main() handle system-level permission errors (exit code 3 + permission hint)
    if (errno?.code === "EACCES" || errno?.code === "EPERM") {
      throw _error;
    }

    const message = _error instanceof Error ? _error.message : String(_error);
    const isValidationError =
      message.includes("Invalid config") || message.includes("Invalid YAML");

    // Standardized error handling for config loading failures
    const configDir = dirname(resolve(configPath));
    const partial = hasPartialState(configDir);
    let hint = isValidationError
      ? "Fix the errors above and try again."
      : "Run 'aligntrue init' to create a valid config";

    if (!isValidationError) {
      if (partial.hasBackups) {
        hint =
          "Previous backups found. Run 'aligntrue backup list' to restore, or 'aligntrue init' for a fresh start.";
      } else if (partial.hasCache) {
        hint =
          "Cached AlignTrue state found but config is missing. Run 'aligntrue init' to recreate configuration.";
      }
    }

    clack.log.error("Failed to load configuration");
    console.error(`\nFile: ${configPath}`);
    console.error(`Error: ${message}`);
    console.error(`\nHint: ${hint}`);
    exitWithError(isValidationError ? 1 : 2, "Failed to load configuration", {
      hint,
    });
  }
}

/**
 * Load configuration without error handling (for commands that need custom handling)
 *
 * @param configPath - Path to config file
 * @returns Validated configuration object or throws error
 */
export async function tryLoadConfig(
  configPath: string = ".aligntrue/config.yaml",
): Promise<AlignTrueConfig> {
  return loadConfig(configPath);
}
