/**
 * Amazon Q MCP transformer
 * Transforms canonical MCP config to .amazonq/mcp.json format
 */

import { createMcpTransformer } from "./factory.js";

export const AmazonqMcpTransformer = createMcpTransformer(".amazonq/mcp.json");
