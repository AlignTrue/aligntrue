/**
 * Central MCP configuration generator
 * Handles MCP server configuration propagation to agent-specific formats
 */

import { computeContentHash } from "@aligntrue/schema";

export interface McpServer {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
}

export interface McpConfigSection {
  heading: string;
  level: number;
  content: string;
  fingerprint: string;
  scope?: string;
  [key: string]: unknown;
}

export interface CanonicalMcpConfig {
  version: string;
  generated_by: string;
  content_hash: string;
  mcpServers?: Record<string, McpServerConfig>;
  fidelity_notes?: string[];
}

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * Generate canonical MCP configuration from MCP servers in config
 * This is the single source of truth for MCP server propagation
 */
export function generateCanonicalMcpConfig(
  servers: McpServer[],
): CanonicalMcpConfig {
  // Build MCP servers map from config
  const mcpServersMap: Record<string, McpServerConfig> = {};

  servers.forEach((server) => {
    // Skip disabled servers
    if (server.disabled) {
      return;
    }

    mcpServersMap[server.name] = {
      command: server.command,
      ...(server.args && { args: server.args }),
      ...(server.env && { env: server.env }),
    };
  });

  // Compute content hash from servers for determinism
  const contentHash = computeContentHash({
    servers: Object.entries(mcpServersMap)
      .map(([name, config]) => ({ name, ...config }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  });

  const config: CanonicalMcpConfig = {
    version: "v1",
    generated_by: "AlignTrue",
    content_hash: contentHash,
  };

  if (Object.keys(mcpServersMap).length > 0) {
    config.mcpServers = mcpServersMap;
  }

  return config;
}
