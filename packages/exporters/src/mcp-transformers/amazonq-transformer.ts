/**
 * Amazon Q MCP transformer
 * Transforms canonical MCP config to .amazonq/mcp.json format
 */

import { join } from "path";
import type { CanonicalMcpConfig } from "@aligntrue/core";
import { BaseMcpTransformer } from "./base-transformer.js";

export class AmazonqMcpTransformer extends BaseMcpTransformer {
  transform(config: CanonicalMcpConfig): string {
    // Amazon Q uses the canonical format directly
    return this.formatJson(config);
  }

  getOutputPath(baseDir: string): string {
    return join(baseDir, ".amazonq", "mcp.json");
  }
}
