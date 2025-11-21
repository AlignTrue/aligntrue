/**
 * Roo Code MCP transformer
 * Transforms canonical MCP config to .roo/mcp.json format
 */

import { join } from "path";
import type { CanonicalMcpConfig } from "@aligntrue/core";
import { BaseMcpTransformer } from "./base-transformer.js";

export class RoocodeMcpTransformer extends BaseMcpTransformer {
  transform(config: CanonicalMcpConfig): string {
    // Roo Code uses the canonical format directly
    return this.formatJson(config);
  }

  getOutputPath(baseDir: string): string {
    return join(baseDir, ".roo", "mcp.json");
  }
}
