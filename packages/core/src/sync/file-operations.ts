/**
 * File operations for sync with backup support
 */

import { readFile, writeFile, copyFile, existsSync } from "fs";
import { promisify } from "util";

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);
const copyFileAsync = promisify(copyFile);

export interface BackupOptions {
  enabled: boolean;
  skipIfIdentical: boolean;
  extension: string;
}

export interface BackupResult {
  backed_up: boolean;
  backup_path?: string;
}

/**
 * Write file with optional backup
 * Creates .bak file before overwriting if enabled
 */
export async function writeFileWithBackup(
  filePath: string,
  content: string,
  options: BackupOptions,
): Promise<BackupResult> {
  if (!options.enabled) {
    await writeFileAsync(filePath, content, "utf-8");
    return { backed_up: false };
  }

  if (existsSync(filePath)) {
    const existing = await readFileAsync(filePath, "utf-8");

    // Skip backup if content identical
    if (options.skipIfIdentical && existing === content) {
      return { backed_up: false };
    }

    const backupPath = `${filePath}${options.extension}`;
    await copyFileAsync(filePath, backupPath);
    await writeFileAsync(filePath, content, "utf-8");
    return { backed_up: true, backup_path: backupPath };
  }

  await writeFileAsync(filePath, content, "utf-8");
  return { backed_up: false };
}

/**
 * Get backup options from config
 */
export function getBackupOptions(
  mode: "solo" | "team" | "enterprise",
  configValue?: "auto" | "always" | "never",
  extension?: string,
): BackupOptions {
  const backupMode = configValue ?? "auto";

  let enabled: boolean;
  if (backupMode === "always") {
    enabled = true;
  } else if (backupMode === "never") {
    enabled = false;
  } else {
    // auto mode: enabled in solo, disabled in team/enterprise
    enabled = mode === "solo";
  }

  return {
    enabled,
    skipIfIdentical: true,
    extension: extension ?? ".bak",
  };
}
