/**
 * Skills resource implementation
 *
 * Skills support - Coming in future release
 *
 * This module provides the foundation for managing AI agent skills
 * across different scopes and storage backends. The implementation is
 * currently a stub that returns empty data.
 *
 * When skills support is added, this will enable:
 * - Managing agent skill configurations
 * - Scope-based skill organization (team, personal, custom)
 * - Storage backend integration (local, repo, remote)
 * - Merging skill configs from multiple sources
 */

import { ResourceManager, type ResourceItem } from "./manager.js";
import type { IStorageBackend } from "../storage/backend.js";
import type { ResourceConfig } from "../config/index.js";

export interface SkillItem extends ResourceItem {
  id: string;
  scope: string;
  name: string;
  description?: string;
  config?: Record<string, unknown>;
}

export class SkillsResourceManager extends ResourceManager<SkillItem> {
  constructor(config: ResourceConfig, cwd: string) {
    super("skills", config, cwd);
  }

  protected async readFromBackend(
    _backend: IStorageBackend,
    _scope: string,
  ): Promise<SkillItem[]> {
    // Skills support coming in future release
    // For now, returns empty array
    return [];
  }

  protected async writeToBackend(
    _backend: IStorageBackend,
    _items: SkillItem[],
    _scope: string,
  ): Promise<void> {
    // Skills support coming in future release
    // For now, no-op
  }

  protected mergeItems(items: Map<string, SkillItem[]>): SkillItem[] {
    // Skills support coming in future release
    // For now, simple concatenation
    const merged: SkillItem[] = [];
    for (const [_scope, scopeItems] of items.entries()) {
      merged.push(...scopeItems);
    }
    return merged;
  }
}
