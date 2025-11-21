/**
 * Windsurf MCP transformer
 * Transforms canonical MCP config to .windsurf/mcp_config.json format
 */

import { join } from "path";
import type { CanonicalMcpConfig } from "@aligntrue/core";
import { BaseMcpTransformer } from "./base-transformer.js";

export class WindsurfMcpTransformer extends BaseMcpTransformer {
  transform(config: CanonicalMcpConfig): string {
    // Windsurf uses the canonical format directly (just different filename)
    return this.formatJson(config);
  }

  getOutputPath(baseDir: string): string {
    return join(baseDir, ".windsurf", "mcp_config.json");
  }
}
