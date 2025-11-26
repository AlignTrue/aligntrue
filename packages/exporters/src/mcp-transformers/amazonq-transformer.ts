/**
 * Amazon Q MCP transformer
 * Transforms canonical MCP config to .amazonq/mcp.json format
 */

import { createMcpTransformer } from "./factory.js";

export const AmazonqMcpTransformer = createMcpTransformer({
  path: ".amazonq/mcp.json",
  format: "generic",
});
