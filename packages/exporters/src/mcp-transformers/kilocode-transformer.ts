/**
 * KiloCode MCP transformer
 * Transforms canonical MCP config to .kilocode/mcp.json format
 */

import { createMcpTransformer } from "./factory.js";

export const KilocodeMcpTransformer =
  createMcpTransformer(".kilocode/mcp.json");
