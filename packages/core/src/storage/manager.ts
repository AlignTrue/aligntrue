/**
 * Storage manager for AlignTrue
 * Factory for creating and managing storage backends
 */

import { execFileSync } from "child_process";
import type { IStorageBackend, Rules } from "./backend.js";
import { LocalStorageBackend } from "./local.js";
import { RepoStorageBackend } from "./repo.js";
import { RemoteStorageBackend } from "./remote.js";
import type { StorageConfig } from "../config/index.js";

export class StorageManager {
  private backends: Map<string, IStorageBackend> = new Map();

  constructor(
    private cwd: string,
    private config: Record<string, StorageConfig>,
  ) {
    this.initBackends();
  }

  private initBackends() {
    for (const [name, storageConfig] of Object.entries(this.config)) {
      this.createBackend(name, storageConfig);
    }
  }

  /**
   * Create storage backend based on configuration
   */
  createBackend(scope: string, config: StorageConfig): IStorageBackend {
    const key = `${scope}:${config.type}`;

    // Return cached backend if exists
    if (this.backends.has(key)) {
      return this.backends.get(key)!;
    }

    let backend: IStorageBackend;

    switch (config.type) {
      case "local":
        backend = new LocalStorageBackend(this.cwd, scope);
        break;

      case "repo":
        backend = new RepoStorageBackend(this.cwd, scope);
        break;

      case "remote":
        if (!config.url) {
          throw new Error(
            `Remote storage for scope "${scope}" requires url in config`,
          );
        }
        backend = new RemoteStorageBackend(
          this.cwd,
          scope,
          config.url,
          config.branch || "main",
          config.path || "",
        );
        break;

      default:
        throw new Error(`Unknown storage type: ${config.type}`);
    }

    this.backends.set(key, backend);
    return backend;
  }

  public getBackend(name: string): IStorageBackend {
    const backend = this.backends.get(name);
    if (!backend) {
      throw new Error(`Storage backend '${name}' not found.`);
    }
    return backend;
  }

  public async readAll(): Promise<Record<string, Rules>> {
    const allRules: Record<string, Rules> = {};
    for (const [name, backend] of this.backends.entries()) {
      allRules[name] = await backend.read();
    }
    return allRules;
  }

  public async writeAll(allRules: Record<string, Rules>): Promise<void> {
    for (const [name, rules] of Object.entries(allRules)) {
      const backend = this.backends.get(name);
      if (backend) {
        await backend.write(rules);
      }
    }
  }

  public async syncAll(): Promise<void> {
    for (const backend of this.backends.values()) {
      await backend.sync();
    }
  }

  /**
   * Test if remote URL is accessible
   */
  async testRemoteAccess(url: string): Promise<{
    accessible: boolean;
    error?: string;
  }> {
    try {
      // Test SSH connectivity
      if (url.startsWith("git@")) {
        const host = url.split("@")[1]?.split(":")[0];
        if (!host) {
          return { accessible: false, error: "Invalid SSH URL format" };
        }

        try {
          execFileSync("ssh", ["-T", host], {
            timeout: 5000,
            stdio: "pipe",
          });
          return { accessible: true };
        } catch (err) {
          // SSH test commands often return non-zero even on success
          // Check if the error message indicates success
          const errorMsg = err instanceof Error ? err.message : String(err);
          if (
            errorMsg.includes("successfully authenticated") ||
            errorMsg.includes("You've successfully authenticated")
          ) {
            return { accessible: true };
          }
          return {
            accessible: false,
            error: `SSH connection failed: ${errorMsg}`,
          };
        }
      }

      // Test HTTPS connectivity
      if (url.startsWith("https://")) {
        try {
          execFileSync("git", ["ls-remote", url, "HEAD"], {
            timeout: 10000,
            stdio: "pipe",
          });
          return { accessible: true };
        } catch (err) {
          return {
            accessible: false,
            error: `HTTPS connection failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }

      return { accessible: false, error: "Unknown URL format" };
    } catch (err) {
      return {
        accessible: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
