/**
 * Scope resolution logic for SyncEngine
 */

import {
  resolveScopes,
  type Scope,
  type ResolvedScope,
  type MergeOrder,
} from "../scope.js";
import type { AlignTrueConfig } from "../config/index.js";

/**
 * Resolve scopes based on configuration
 */
export function resolveSyncScopes(
  config: AlignTrueConfig,
  cwd: string,
): ResolvedScope[] {
  const scopeConfig: {
    scopes: Scope[];
    merge?: { strategy?: "deep"; order?: MergeOrder };
  } = {
    scopes: config.scopes || [],
  };

  if (config.merge) {
    scopeConfig.merge = config.merge;
  }

  const resolvedScopes = resolveScopes(cwd, scopeConfig);

  // If no scopes defined, create default scope
  if (resolvedScopes.length === 0) {
    return [
      {
        path: ".",
        normalizedPath: ".",
        isDefault: true,
      } as ResolvedScope,
    ];
  }

  return resolvedScopes;
}
