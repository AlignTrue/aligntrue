/**
 * Firebase MCP transformer
 * Transforms canonical MCP config to .idx/mcp.json format
 */

import { createMcpTransformer } from "./factory.js";

export const FirebaseMcpTransformer = createMcpTransformer(".idx/mcp.json");
