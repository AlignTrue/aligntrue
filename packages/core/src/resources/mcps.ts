/**
 * MCPs resource implementation (stub)
 * TODO: Implement when MCP support is added
 */

import { ResourceManager, type ResourceItem } from "./manager.js";
import type { StorageBackend } from "../storage/backend.js";
import type { ResourceConfig } from "../config/index.js";

export interface MCPItem extends ResourceItem {
  id: string;
  scope: string;
  name: string;
  url: string;
  config?: Record<string, any>;
}

export class MCPsResourceManager extends ResourceManager<MCPItem> {
  constructor(config: ResourceConfig, cwd: string) {
    super("mcps", config, cwd);
  }

  protected async readFromBackend(
    backend: StorageBackend,
    scope: string,
  ): Promise<MCPItem[]> {
    // TODO: Implement MCP reading
    return [];
  }

  protected async writeToBackend(
    backend: StorageBackend,
    items: MCPItem[],
    scope: string,
  ): Promise<void> {
    // TODO: Implement MCP writing
  }

  protected mergeItems(items: Map<string, MCPItem[]>): MCPItem[] {
    // TODO: Implement MCP merging
    const merged: MCPItem[] = [];
    for (const [scope, scopeItems] of items.entries()) {
      merged.push(...scopeItems);
    }
    return merged;
  }
}
