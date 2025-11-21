/**
 * VS Code MCP transformer
 * Transforms canonical MCP config to .vscode/mcp.json format
 */

import { join } from "path";
import type { CanonicalMcpConfig } from "@aligntrue/core";
import { BaseMcpTransformer } from "./base-transformer.js";

export class VscodeMcpTransformer extends BaseMcpTransformer {
  transform(config: CanonicalMcpConfig): string {
    // VS Code uses the canonical format directly
    return this.formatJson(config);
  }

  getOutputPath(baseDir: string): string {
    return join(baseDir, ".vscode", "mcp.json");
  }
}
