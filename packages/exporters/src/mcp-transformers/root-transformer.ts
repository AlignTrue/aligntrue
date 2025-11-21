/**
 * Root MCP transformer
 * Transforms canonical MCP config to .mcp.json format (root level)
 * Used by Claude Code, Aider, and other agents
 */

import { join } from "path";
import type { CanonicalMcpConfig } from "@aligntrue/core";
import { BaseMcpTransformer } from "./base-transformer.js";

export class RootMcpTransformer extends BaseMcpTransformer {
  transform(config: CanonicalMcpConfig): string {
    // Root MCP uses the canonical format directly
    return this.formatJson(config);
  }

  getOutputPath(baseDir: string): string {
    return join(baseDir, ".mcp.json");
  }
}
