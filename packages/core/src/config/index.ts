/**
 * Configuration management for AlignTrue
 * Handles solo/team/enterprise modes and module flags
 */

import { 
  validateScopePath, 
  validateGlobPatterns, 
  validateMergeOrder,
  type MergeOrder 
} from '../scope.js'

export type AlignTrueMode = 'solo' | 'team' | 'enterprise';

export interface AlignTrueConfig {
  version: string;
  mode: AlignTrueMode;
  modules?: {
    lockfile?: boolean;
    bundle?: boolean;
    checks?: boolean;
    mcp?: boolean;
  };
  git?: {
    mode?: 'ignore' | 'commit' | 'branch';
    per_adapter?: Record<string, 'ignore' | 'commit' | 'branch'>;
  };
  sources?: Array<{
    type: 'local' | 'catalog' | 'git' | 'url';
    path?: string;
    url?: string;
  }>;
  exporters?: string[];
  scopes?: Array<{
    path: string;
    include?: string[];
    exclude?: string[];
    rulesets?: string[];
  }>;
  merge?: {
    strategy?: 'deep';
    order?: MergeOrder;
  };
}

export async function loadConfig(configPath: string): Promise<AlignTrueConfig> {
  throw new Error('Not implemented');
}

/**
 * Validate configuration structure and values
 */
export async function validateConfig(config: AlignTrueConfig): Promise<void> {
  // Validate mode
  const validModes: AlignTrueMode[] = ['solo', 'team', 'enterprise']
  if (!validModes.includes(config.mode)) {
    throw new Error(`Invalid mode "${config.mode}": must be one of ${validModes.join(', ')}`)
  }
  
  // Validate scopes array if present
  if (config.scopes && Array.isArray(config.scopes)) {
    for (let i = 0; i < config.scopes.length; i++) {
      const scope = config.scopes[i]
      if (!scope) {
        throw new Error(`Invalid scope at index ${i}: scope is null or undefined`)
      }
      
      // Validate required path field
      if (!scope.path || typeof scope.path !== 'string') {
        throw new Error(`Invalid scope at index ${i}: missing or invalid "path" field`)
      }
      
      try {
        validateScopePath(scope.path)
      } catch (err) {
        throw new Error(`Invalid scope at index ${i}: ${err instanceof Error ? err.message : String(err)}`)
      }
      
      try {
        validateGlobPatterns(scope.include)
      } catch (err) {
        throw new Error(`Invalid scope at index ${i}, include patterns: ${err instanceof Error ? err.message : String(err)}`)
      }
      
      try {
        validateGlobPatterns(scope.exclude)
      } catch (err) {
        throw new Error(`Invalid scope at index ${i}, exclude patterns: ${err instanceof Error ? err.message : String(err)}`)
      }
      
      // Validate rulesets is array of strings if present
      if (scope.rulesets !== undefined) {
        if (!Array.isArray(scope.rulesets)) {
          throw new Error(`Invalid scope at index ${i}: "rulesets" must be an array`)
        }
        for (const ruleset of scope.rulesets) {
          if (typeof ruleset !== 'string') {
            throw new Error(`Invalid scope at index ${i}: ruleset IDs must be strings`)
          }
        }
      }
    }
  }
  
  // Validate merge order if present
  if (config.merge?.order) {
    try {
      validateMergeOrder(config.merge.order)
    } catch (err) {
      throw new Error(`Invalid merge order: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  
  // Validate git mode if present
  if (config.git?.mode) {
    const validGitModes = ['ignore', 'commit', 'branch']
    if (!validGitModes.includes(config.git.mode)) {
      throw new Error(`Invalid git mode "${config.git.mode}": must be one of ${validGitModes.join(', ')}`)
    }
  }
}

