/**
 * Storage manager for AlignTrue
 * Factory for creating and managing storage backends
 */

import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import type { StorageBackend } from "./backend.js";
import { LocalStorage, RepoStorage, RemoteStorage } from "./backend.js";
import type { StorageConfig } from "../config/index.js";

export class StorageManager {
  private backends: Map<string, StorageBackend> = new Map();

  constructor(private cwd: string) {}

  /**
   * Create storage backend based on configuration
   */
  createBackend(scope: string, config: StorageConfig): StorageBackend {
    const key = `${scope}:${config.type}`;

    // Return cached backend if exists
    if (this.backends.has(key)) {
      return this.backends.get(key)!;
    }

    let backend: StorageBackend;

    switch (config.type) {
      case "local":
        backend = new LocalStorage(this.cwd, scope);
        this.ensureLocalDirectory();
        break;

      case "repo":
        backend = new RepoStorage(this.cwd, scope);
        break;

      case "remote":
        if (!config.url) {
          throw new Error(
            `Remote storage for scope "${scope}" requires url in config`,
          );
        }
        backend = new RemoteStorage(
          this.cwd,
          scope,
          config.url,
          config.branch,
          config.path,
        );
        this.ensureRemoteDirectory(scope);
        break;

      default:
        throw new Error(`Unknown storage type: ${config.type}`);
    }

    this.backends.set(key, backend);
    return backend;
  }

  /**
   * Get all backends for a resource
   */
  getBackends(
    scopes: Record<string, any>,
    storage: Record<string, StorageConfig>,
  ): Map<string, StorageBackend> {
    const backends = new Map<string, StorageBackend>();

    for (const scope of Object.keys(scopes)) {
      const storageConfig = storage[scope];
      if (!storageConfig) {
        throw new Error(`No storage configuration for scope: ${scope}`);
      }

      const backend = this.createBackend(scope, storageConfig);
      backends.set(scope, backend);
    }

    return backends;
  }

  /**
   * Ensure .aligntrue/.local/ directory exists
   */
  private ensureLocalDirectory(): void {
    const localDir = join(this.cwd, ".aligntrue", ".local");
    if (!existsSync(localDir)) {
      mkdirSync(localDir, { recursive: true });
    }
  }

  /**
   * Ensure .aligntrue/.remotes/<scope>/ directory exists
   */
  private ensureRemoteDirectory(scope: string): void {
    const remoteDir = join(this.cwd, ".aligntrue", ".remotes", scope);
    if (!existsSync(remoteDir)) {
      mkdirSync(remoteDir, { recursive: true });
    }
  }

  /**
   * Clone remote repository
   */
  async cloneRemote(
    scope: string,
    url: string,
    branch: string = "main",
  ): Promise<void> {
    const remoteDir = join(this.cwd, ".aligntrue", ".remotes", scope);

    // TODO: Implement git clone
    // For now, just ensure directory exists
    this.ensureRemoteDirectory(scope);
  }

  /**
   * Test if remote URL is accessible
   */
  async testRemoteAccess(url: string): Promise<boolean> {
    // TODO: Implement SSH/HTTPS test
    // For now, return true
    return true;
  }

  /**
   * Sync all remote backends
   */
  async syncAll(): Promise<void> {
    const remoteBackends = Array.from(this.backends.values()).filter(
      (backend) => backend.getMetadata().type === "remote",
    );

    for (const backend of remoteBackends) {
      await backend.sync();
    }
  }
}
