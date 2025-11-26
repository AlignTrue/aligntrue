/**
 * Roo Code MCP transformer
 * Transforms canonical MCP config to .roo/mcp.json format
 */

import { createMcpTransformer } from "./factory.js";

export const RoocodeMcpTransformer = createMcpTransformer({
  path: ".roo/mcp.json",
  format: "generic",
});
