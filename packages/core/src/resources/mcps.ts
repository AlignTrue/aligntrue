/**
 * MCPs resource implementation
 *
 * DEFERRED: MCP server configurations as shareable resources
 *
 * This module provides the foundation for managing MCP configurations
 * across different scopes and storage backends. Currently, this is a stub
 * that returns empty data.
 *
 * Current approach (v1):
 * - MCP servers defined centrally in .aligntrue/config.yaml
 * - Exporters propagate to agent-specific MCP config files
 * - No sharing/versioning of MCP definitions
 *
 * Future extension could enable:
 * - Managing MCP server configurations as shareable resources
 * - Scope-based MCP organization (team, personal, custom)
 * - Storage backend integration (local, repo, remote)
 * - Merging MCP configs from multiple sources
 *
 * Trigger for revisiting: When users request shared MCP server libraries
 * or team-wide MCP configuration templates.
 */

import { ResourceManager, type ResourceItem } from "./manager.js";
import type { IStorageBackend } from "../storage/backend.js";
import type { ResourceConfig } from "../config/index.js";

export interface MCPItem extends ResourceItem {
  id: string;
  scope: string;
  name: string;
  url: string;
  config?: Record<string, unknown>;
}

export class MCPsResourceManager extends ResourceManager<MCPItem> {
  constructor(config: ResourceConfig, cwd: string) {
    super("mcps", config, cwd);
  }

  protected async readFromBackend(
    _backend: IStorageBackend,
    _scope: string,
  ): Promise<MCPItem[]> {
    // MCP support deferred - returns empty array
    // Current implementation uses centralized config.mcp.servers
    return [];
  }

  protected async writeToBackend(
    _backend: IStorageBackend,
    _items: MCPItem[],
    _scope: string,
  ): Promise<void> {
    // MCP support deferred - no-op
    // Current implementation uses centralized config.mcp.servers
  }

  protected mergeItems(items: Map<string, MCPItem[]>): MCPItem[] {
    // MCP support deferred - simple concatenation
    // Current implementation uses centralized config.mcp.servers
    const merged: MCPItem[] = [];
    for (const [_scope, scopeItems] of items.entries()) {
      merged.push(...scopeItems);
    }
    return merged;
  }
}
