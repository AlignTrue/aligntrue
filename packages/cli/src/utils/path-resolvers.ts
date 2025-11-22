/**
 * Path resolution utilities for CLI commands
 */

import { resolve } from "path";
import { getAlignTruePaths } from "@aligntrue/core";

/**
 * Resolve config path from flag or defaults
 *
 * @param pathArg - Optional path argument from CLI flag
 * @param cwd - Current working directory
 * @returns Resolved config file path
 */
export function resolveConfigPath(
  pathArg: string | undefined,
  cwd: string,
): string {
  if (pathArg) {
    return resolve(cwd, pathArg);
  }
  return getAlignTruePaths(cwd).config;
}
