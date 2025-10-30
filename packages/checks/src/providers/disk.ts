/**
 * Disk-based file provider implementation
 */

import { readFile, access } from "fs/promises";
import { join, resolve } from "path";
import fg from "fast-glob";
import type { FileProvider, GlobOptions } from "../types.js";

/**
 * File provider that reads from disk using Node.js fs
 */
export class DiskFileProvider implements FileProvider {
  constructor(private readonly basePath: string = process.cwd()) {}

  async glob(pattern: string, options?: GlobOptions): Promise<string[]> {
    const cwd = options?.cwd
      ? resolve(this.basePath, options.cwd)
      : this.basePath;

    const results = await fg(pattern, {
      cwd,
      ignore: options?.ignore || ["**/node_modules/**", "**/.git/**"],
      followSymbolicLinks: options?.followSymlinks ?? false,
      dot: true,
    });

    return results;
  }

  async readFile(path: string): Promise<string> {
    const fullPath = resolve(this.basePath, path);
    return readFile(fullPath, "utf8");
  }

  async exists(path: string): Promise<boolean> {
    const fullPath = resolve(this.basePath, path);
    try {
      await access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async readJson(path: string): Promise<unknown> {
    const content = await this.readFile(path);
    try {
      return JSON.parse(content);
    } catch (err) {
      throw new Error(
        `Failed to parse JSON file: ${path}\n` +
          `  ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
