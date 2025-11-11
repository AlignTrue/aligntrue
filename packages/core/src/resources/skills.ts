/**
 * Skills resource implementation (stub)
 * TODO: Implement when skills support is added
 */

import { ResourceManager, type ResourceItem } from "./manager.js";
import type { StorageBackend } from "../storage/backend.js";
import type { ResourceConfig } from "../config/index.js";

export interface SkillItem extends ResourceItem {
  id: string;
  scope: string;
  name: string;
  description?: string;
  config?: Record<string, any>;
}

export class SkillsResourceManager extends ResourceManager<SkillItem> {
  constructor(config: ResourceConfig, cwd: string) {
    super("skills", config, cwd);
  }

  protected async readFromBackend(
    backend: StorageBackend,
    scope: string,
  ): Promise<SkillItem[]> {
    // TODO: Implement skills reading
    return [];
  }

  protected async writeToBackend(
    backend: StorageBackend,
    items: SkillItem[],
    scope: string,
  ): Promise<void> {
    // TODO: Implement skills writing
  }

  protected mergeItems(items: Map<string, SkillItem[]>): SkillItem[] {
    // TODO: Implement skills merging
    const merged: SkillItem[] = [];
    for (const [scope, scopeItems] of items.entries()) {
      merged.push(...scopeItems);
    }
    return merged;
  }
}
