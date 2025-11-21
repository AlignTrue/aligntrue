/**
 * KiloCode MCP transformer
 * Transforms canonical MCP config to .kilocode/mcp.json format
 */

import { join } from "path";
import type { CanonicalMcpConfig } from "@aligntrue/core";
import { BaseMcpTransformer } from "./base-transformer.js";

export class KilocodeMcpTransformer extends BaseMcpTransformer {
  transform(config: CanonicalMcpConfig): string {
    // KiloCode uses the canonical format directly
    return this.formatJson(config);
  }

  getOutputPath(baseDir: string): string {
    return join(baseDir, ".kilocode", "mcp.json");
  }
}
