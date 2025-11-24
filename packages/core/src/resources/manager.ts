/**
 * Resource manager - Generic resource handling for rules, MCPs, skills, etc.
 *
 * EXTENSIBILITY:
 * This abstract class provides a unified interface for managing different types of
 * AI resources (Rules, MCP Configs, Skills) across multiple storage backends.
 *
 * It abstracts away:
 * - Storage backend initialization (Local, Repo, Remote)
 * - Scope management
 * - Synchronization logic
 *
 * Future resource types (e.g., Skills) can be added by extending this class
 * and implementing format conversion methods.
 */

import type { ResourceType, ResourceConfig } from "../config/index.js";
import { StorageManager } from "../storage/manager.js";
import type { IStorageBackend } from "../storage/backend.js";

export interface ResourceItem extends Record<string, unknown> {
  id: string;
  scope: string;
}

export abstract class ResourceManager<T extends ResourceItem> {
  protected storageManager: StorageManager;
  protected backends: Map<string, IStorageBackend>;

  constructor(
    protected type: ResourceType,
    protected config: ResourceConfig,
    protected cwd: string,
  ) {
    this.storageManager = new StorageManager(cwd, config.storage);
    // Initialize backends for each scope
    this.backends = new Map();
    for (const scope of Object.keys(config.scopes)) {
      const storageConfig = config.storage[scope];
      if (storageConfig) {
        const backend = this.storageManager.createBackend(scope, storageConfig);
        this.backends.set(scope, backend);
      }
    }
  }

  /**
   * Sync all scopes
   */
  async sync(): Promise<void> {
    // Read from all storage backends
    const allItems = new Map<string, T[]>();

    for (const [scope, backend] of this.backends.entries()) {
      const items = await this.readFromBackend(backend, scope);
      allItems.set(scope, items);
    }

    // Merge items (subclass implements merge logic)
    const merged = this.mergeItems(allItems);

    // Write back to respective backends
    for (const [scope, backend] of this.backends.entries()) {
      const scopeItems = merged.filter((item) => item.scope === scope);
      await this.writeToBackend(backend, scopeItems, scope);
    }

    // Sync remote backends
    await this.storageManager.syncAll();
  }

  /**
   * Read items for a specific scope
   */
  async read(scope: string): Promise<T[]> {
    const backend = this.backends.get(scope);
    if (!backend) {
      throw new Error(`No backend configured for scope: ${scope}`);
    }

    return this.readFromBackend(backend, scope);
  }

  /**
   * Write items for a specific scope
   */
  async write(scope: string, items: T[]): Promise<void> {
    const backend = this.backends.get(scope);
    if (!backend) {
      throw new Error(`No backend configured for scope: ${scope}`);
    }

    await this.writeToBackend(backend, items, scope);
  }

  /**
   * Get all items across all scopes
   */
  async getAll(): Promise<T[]> {
    const allItems: T[] = [];

    for (const [scope, backend] of this.backends.entries()) {
      const items = await this.readFromBackend(backend, scope);
      allItems.push(...items);
    }

    return allItems;
  }

  /**
   * Read items from a storage backend
   * Subclasses implement this to convert storage format to resource format
   */
  protected abstract readFromBackend(
    backend: IStorageBackend,
    scope: string,
  ): Promise<T[]>;

  /**
   * Write items to a storage backend
   * Subclasses implement this to convert resource format to storage format
   */
  protected abstract writeToBackend(
    backend: IStorageBackend,
    items: T[],
    scope: string,
  ): Promise<void>;

  /**
   * Merge items from multiple scopes
   * Subclasses implement merge logic
   */
  protected abstract mergeItems(items: Map<string, T[]>): T[];
}
