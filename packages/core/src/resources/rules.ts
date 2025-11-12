/**
 * Rules resource implementation
 */

import type { AlignSection } from "@aligntrue/schema";
import { ResourceManager, type ResourceItem } from "./manager.js";
import type { IStorageBackend } from "../storage/backend.js";
import type { ResourceConfig } from "../config/index.js";

export interface RuleItem extends ResourceItem {
  id: string;
  scope: string;
  heading: string;
  content: string;
  level: number;
  fingerprint?: string;
}

export class RulesResourceManager extends ResourceManager<RuleItem> {
  constructor(config: ResourceConfig, cwd: string) {
    super("rules", config, cwd);
  }

  /**
   * Read rules from storage backend
   */
  protected async readFromBackend(
    backend: IStorageBackend,
    _scope: string,
  ): Promise<RuleItem[]> {
    const sections = await backend.read();

    return sections.map((section) => ({
      id: section.fingerprint || section.heading,
      scope: _scope,
      heading: section.heading,
      content: section.content,
      level: section.level,
      fingerprint: section.fingerprint,
    }));
  }

  /**
   * Write rules to storage backend
   */
  protected async writeToBackend(
    backend: IStorageBackend,
    items: RuleItem[],
    _scope: string,
  ): Promise<void> {
    const sections: AlignSection[] = items.map((item) => ({
      heading: item.heading,
      content: item.content,
      level: item.level,
      fingerprint: item.fingerprint || "",
    }));

    await backend.write(sections);
  }

  /**
   * Merge rules from multiple scopes
   * For rules, we just concatenate all items (no conflict resolution)
   */
  protected mergeItems(items: Map<string, RuleItem[]>): RuleItem[] {
    const merged: RuleItem[] = [];

    for (const [_scope, scopeItems] of items.entries()) {
      merged.push(...scopeItems);
    }

    return merged;
  }

  /**
   * Filter rules by scope
   */
  filterByScope(items: RuleItem[], scope: string): RuleItem[] {
    return items.filter((item) => item.scope === scope);
  }

  /**
   * Get rules for a specific heading
   */
  findByHeading(items: RuleItem[], heading: string): RuleItem | undefined {
    return items.find(
      (item) => item.heading.toLowerCase() === heading.toLowerCase(),
    );
  }
}
