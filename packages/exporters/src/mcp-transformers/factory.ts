/**
 * Factory for creating simple MCP transformers
 * Reduces boilerplate for transformers that just dump JSON to a path
 */

import { join } from "path";
import type { CanonicalMcpConfig } from "@aligntrue/core";
import { BaseMcpTransformer } from "./base-transformer.js";

/**
 * Create a standard MCP transformer class
 *
 * @param relativePath - Relative path for the output file (e.g. ".vscode/mcp.json")
 * @returns Transformer class constructor
 */
export function createMcpTransformer(relativePath: string) {
  return class SimpleMcpTransformer extends BaseMcpTransformer {
    transform(config: CanonicalMcpConfig): string {
      return this.formatJson(config);
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
