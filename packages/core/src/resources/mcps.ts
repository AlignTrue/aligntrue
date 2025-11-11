/**
 * MCPs resource implementation
 *
 * MCP (Model Context Protocol) support - Coming in future release
 *
 * This module provides the foundation for managing MCP configurations
 * across different scopes and storage backends. The implementation is
 * currently a stub that returns empty data.
 *
 * When MCP support is added, this will enable:
 * - Managing MCP server configurations
 * - Scope-based MCP organization (team, personal, custom)
 * - Storage backend integration (local, repo, remote)
 * - Merging MCP configs from multiple sources
 */

import { ResourceManager, type ResourceItem } from "./manager.js";
import type { IStorageBackend } from "../storage/backend.js";
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
    backend: IStorageBackend,
    scope: string,
  ): Promise<MCPItem[]> {
    // MCP support coming in future release
    // For now, returns empty array
    return [];
  }

  protected async writeToBackend(
    backend: IStorageBackend,
    items: MCPItem[],
    scope: string,
  ): Promise<void> {
    // MCP support coming in future release
    // For now, no-op
  }

  protected mergeItems(items: Map<string, MCPItem[]>): MCPItem[] {
    // MCP support coming in future release
    // For now, simple concatenation
    const merged: MCPItem[] = [];
    for (const [scope, scopeItems] of items.entries()) {
      merged.push(...scopeItems);
    }
    return merged;
  }
}
