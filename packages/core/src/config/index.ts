/**
 * Configuration management for AlignTrue
 * Handles solo/team/enterprise modes and module flags
 */

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
  }>;
}

export async function loadConfig(configPath: string): Promise<AlignTrueConfig> {
  throw new Error('Not implemented');
}

export async function validateConfig(config: AlignTrueConfig): Promise<void> {
  throw new Error('Not implemented');
}

