/**
 * Windsurf MCP transformer
 * Transforms canonical MCP config to .windsurf/mcp_config.json format
 */

import { createMcpTransformer } from "./factory.js";

export const WindsurfMcpTransformer = createMcpTransformer({
  path: ".windsurf/mcp_config.json",
  format: "windsurf",
});
