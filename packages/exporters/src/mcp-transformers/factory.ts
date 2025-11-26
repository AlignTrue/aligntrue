/**
 * Factory for creating MCP transformers
 * Handles agent-specific MCP configuration formats
 */

import { join } from "path";
import type { CanonicalMcpConfig } from "@aligntrue/core";
import { BaseMcpTransformer } from "./base-transformer.js";

export type McpTransformFormat = "generic" | "vscode" | "cursor" | "windsurf";

interface TransformerConfig {
  path: string;
  format?: McpTransformFormat;
}

/**
 * Create a standard MCP transformer class
 *
 * @param config - Transformer configuration with path and optional format
 * @returns Transformer class constructor
 */
export function createMcpTransformer(config: TransformerConfig | string) {
  // Support string shorthand for backward compatibility
  const normalizedConfig: TransformerConfig =
    typeof config === "string" ? { path: config } : config;
  const { path: relativePath, format = "generic" } = normalizedConfig;

  return class McpTransformer extends BaseMcpTransformer {
    transform(config: CanonicalMcpConfig): string {
      // Format config based on agent type
      let output: unknown = config;

      if (format === "vscode" && config.mcpServers) {
        // VS Code expects { "servers": { name: config } }
        output = {
          servers: config.mcpServers,
        };
      } else if (format === "cursor" && config.mcpServers) {
        // Cursor expects { "mcpServers": { name: config } }
        output = {
          mcpServers: config.mcpServers,
        };
      } else if (format === "windsurf" && config.mcpServers) {
        // Windsurf expects similar to Cursor
        output = {
          mcpServers: config.mcpServers,
        };
      }

      return this.formatJson(output);
    }

    getOutputPath(baseDir: string): string {
      // Handle root paths safely
      if (relativePath.startsWith("./")) {
        const cleanPath = relativePath.slice(2);
        return join(baseDir, cleanPath);
      }
      // Handle nested paths (split by slash to work cross-platform with join)
      const parts = relativePath.split("/");
      return join(baseDir, ...parts);
    }
  };
}
