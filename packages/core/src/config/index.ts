/**
 * Configuration management for AlignTrue
 * Handles solo/team/enterprise modes and module flags
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as yaml from 'js-yaml'
import Ajv, { type ValidateFunction, type ErrorObject } from 'ajv'
import addFormats from 'ajv-formats'
import { 
  validateScopePath, 
  validateGlobPatterns, 
  validateMergeOrder,
  type MergeOrder 
} from '../scope.js'

export type AlignTrueMode = 'solo' | 'team' | 'enterprise';

export interface AlignTrueConfig {
  version: string | undefined;
  mode: AlignTrueMode;
  modules?: {
    lockfile?: boolean;
    bundle?: boolean;
    checks?: boolean;
    mcp?: boolean;
  };
  lockfile?: {
    mode?: 'off' | 'soft' | 'strict';
  };
  git?: {
    mode?: 'ignore' | 'commit' | 'branch';
    per_adapter?: Record<string, 'ignore' | 'commit' | 'branch'>;
  };
  sync?: {
    auto_pull?: boolean;
    primary_agent?: string;
    on_conflict?: 'prompt' | 'keep_ir' | 'accept_agent';
  };
  sources?: Array<{
    type: 'local' | 'catalog' | 'git' | 'url';
    path?: string;
    url?: string;
    id?: string;
    version?: string;
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

/**
 * Validation result from schema validation
 */
interface SchemaValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
    keyword?: string;
    params?: Record<string, unknown>;
  }>;
}

// Load JSON Schema and initialize Ajv
const __dirname = dirname(fileURLToPath(import.meta.url))
const schemaPath = resolve(__dirname, '../../schema/config.schema.json')
const configSchema = JSON.parse(readFileSync(schemaPath, 'utf8'))

const ajv = new Ajv({
  strict: true,
  allErrors: true,
  verbose: true,
  validateSchema: false, // Avoid metaschema validation issues
})
addFormats(ajv)

const validateSchemaFn: ValidateFunction = ajv.compile(configSchema)

/**
 * Validate config against JSON Schema
 */
function validateConfigSchema(config: unknown): SchemaValidationResult {
  const valid = validateSchemaFn(config)
  
  if (valid) {
    return { valid: true }
  }
  
  const errors = (validateSchemaFn.errors || []).map((err: ErrorObject) => {
    const path = err.instancePath || '(root)'
    let message = err.message || 'Validation error'
    
    // Enhance error messages with more context
    if (err.keyword === 'enum') {
      const allowedValues = (err.params as { allowedValues?: unknown[] }).allowedValues || []
      message = `${message}. Allowed values: ${allowedValues.join(', ')}`
    } else if (err.keyword === 'required') {
      const missingProperty = (err.params as { missingProperty?: string }).missingProperty
      message = `Missing required field: ${missingProperty}`
    } else if (err.keyword === 'type') {
      const expectedType = (err.params as { type?: string }).type
      message = `Expected type ${expectedType}`
    }
    
    return {
      path: path.replace(/^\//, '').replace(/\//g, '.') || '(root)',
      message,
      keyword: err.keyword,
      params: err.params as Record<string, unknown>,
    }
  })
  
  return { valid: false, errors }
}

/**
 * Format validation errors for user display
 */
function formatValidationErrors(errors: SchemaValidationResult['errors']): string {
  if (!errors || errors.length === 0) {
    return 'Unknown validation error'
  }
  
  return errors
    .map(err => `  - ${err.path}: ${err.message}`)
    .join('\n')
}

/**
 * Apply mode-specific defaults to config
 */
export function applyDefaults(config: AlignTrueConfig): AlignTrueConfig {
  const result: AlignTrueConfig = { ...config }
  
  // Auto-detect mode if not specified
  if (!result.mode) {
    // If only exporters configured (minimal config), default to solo
    if (result.exporters && result.exporters.length > 0 && !result.modules?.lockfile && !result.modules?.bundle) {
      result.mode = 'solo'
    } else if (result.modules?.lockfile || result.modules?.bundle) {
      result.mode = 'team'
    } else {
      result.mode = 'solo' // Default to solo
    }
  }
  
  // Auto-set version if not specified
  if (!result.version) {
    result.version = '1'
  }
  
  // Initialize modules if not present
  if (!result.modules) {
    result.modules = {}
  }
  
  // Apply mode-specific module defaults
  if (result.mode === 'solo') {
    result.modules.lockfile = result.modules.lockfile ?? false
    result.modules.bundle = result.modules.bundle ?? false
    result.modules.checks = result.modules.checks ?? true
    result.modules.mcp = result.modules.mcp ?? false
  } else if (config.mode === 'team') {
    result.modules.lockfile = result.modules.lockfile ?? true
    result.modules.bundle = result.modules.bundle ?? true
    result.modules.checks = result.modules.checks ?? true
    result.modules.mcp = result.modules.mcp ?? false
  } else if (config.mode === 'enterprise') {
    result.modules.lockfile = result.modules.lockfile ?? true
    result.modules.bundle = result.modules.bundle ?? true
    result.modules.checks = result.modules.checks ?? true
    result.modules.mcp = result.modules.mcp ?? true
  }
  
  // Apply lockfile defaults
  if (!result.lockfile) {
    result.lockfile = {}
  }
  // Default to 'soft' mode for team/enterprise when lockfile enabled
  if (result.modules.lockfile) {
    result.lockfile.mode = result.lockfile.mode ?? 'soft'
  } else {
    result.lockfile.mode = result.lockfile.mode ?? 'off'
  }
  
  // Apply git defaults
  if (!result.git) {
    result.git = {}
  }
  if (config.mode === 'solo' || config.mode === 'team') {
    result.git.mode = result.git.mode ?? 'ignore'
  } else if (config.mode === 'enterprise') {
    result.git.mode = result.git.mode ?? 'commit'
  }
  
  // Apply sync defaults
  if (!result.sync) {
    result.sync = {}
  }
  
  // Solo mode: auto_pull ON by default (enables native-format editing), accept_agent on conflict
  if (config.mode === 'solo') {
    result.sync.auto_pull = result.sync.auto_pull ?? true  // ON for solo (Phase 2 intent)
    result.sync.on_conflict = result.sync.on_conflict ?? 'accept_agent'
    // Auto-detect primary_agent if not set (first exporter that supports import)
    if (!result.sync.primary_agent && result.exporters && result.exporters.length > 0) {
      const importableAgents = ['cursor', 'copilot', 'claude-code', 'aider', 'agents-md']
      const detected = result.exporters.find(e => importableAgents.includes(e.toLowerCase()))
      if (detected) {
        result.sync.primary_agent = detected
      }
    }
  } else {
    // Team/enterprise mode: auto_pull off by default, prompt on conflict
    result.sync.auto_pull = result.sync.auto_pull ?? false
    result.sync.on_conflict = result.sync.on_conflict ?? 'prompt'
  }
  
  // Apply exporter defaults
  if (!result.exporters || result.exporters.length === 0) {
    result.exporters = ['cursor', 'agents-md']
  }
  
  // Apply source defaults
  if (!result.sources || result.sources.length === 0) {
    result.sources = [{ type: 'local', path: '.aligntrue/rules.md' }]
  }
  
  return result
}

/**
 * Check for unknown fields and emit warnings
 */
function checkUnknownFields(config: Record<string, unknown>, configPath: string): void {
  const knownFields = new Set([
    'version', 'mode', 'modules', 'lockfile', 'git', 'sync', 'sources', 'exporters', 'scopes', 'merge'
  ])
  
  for (const key of Object.keys(config)) {
    if (!knownFields.has(key)) {
      console.warn(
        `Warning: Unknown config field "${key}" in ${configPath}\n` +
        `  This field will be ignored. Valid fields: ${Array.from(knownFields).join(', ')}`
      )
    }
  }
}

/**
 * Validate configuration structure and values
 */
export async function validateConfig(config: AlignTrueConfig, configPath?: string): Promise<void> {
  // Validate mode
  const validModes: AlignTrueMode[] = ['solo', 'team', 'enterprise']
  if (!validModes.includes(config.mode)) {
    throw new Error(`Invalid mode "${config.mode}": must be one of ${validModes.join(', ')}`)
  }
  
  // Check for unknown fields (warnings only)
  if (configPath) {
    checkUnknownFields(config as unknown as Record<string, unknown>, configPath)
  }
  
  // Validate module flags if present
  if (config.modules) {
    for (const [key, value] of Object.entries(config.modules)) {
      if (typeof value !== 'boolean' && value !== undefined) {
        throw new Error(`Invalid modules.${key}: must be boolean, got ${typeof value}`)
      }
    }
  }
  
  // Validate sources array if present
  if (config.sources && Array.isArray(config.sources)) {
    for (let i = 0; i < config.sources.length; i++) {
      const source = config.sources[i]
      if (!source || typeof source !== 'object') {
        throw new Error(`Invalid source at index ${i}: must be an object`)
      }
      
      // Type-specific validation
      if (source.type === 'local' && !source.path) {
        throw new Error(`Invalid source at index ${i}: "path" is required for type "local"`)
      } else if ((source.type === 'git' || source.type === 'url') && !source.url) {
        throw new Error(`Invalid source at index ${i}: "url" is required for type "${source.type}"`)
      } else if (source.type === 'catalog' && !source.id) {
        throw new Error(`Invalid source at index ${i}: "id" is required for type "catalog"`)
      }
      
      // Security: Validate local source paths for traversal attacks
      if (source.type === 'local' && source.path) {
        try {
          validateScopePath(source.path)
        } catch (err) {
          throw new Error(`Invalid source at index ${i}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }
  }
  
  // Validate exporters array if present
  if (config.exporters && Array.isArray(config.exporters)) {
    for (let i = 0; i < config.exporters.length; i++) {
      const exporter = config.exporters[i]
      if (typeof exporter !== 'string' || exporter.trim() === '') {
        throw new Error(`Invalid exporter at index ${i}: must be non-empty string`)
      }
    }
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
    
    // Warn if scopes defined but empty
    if (config.scopes.length === 0) {
      console.warn(`Warning: "scopes" array is defined but empty. Consider removing it or adding scope definitions.`)
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
  
  // Cross-field validation: warn about mode/module inconsistencies
  if (config.mode === 'solo' && config.modules?.lockfile === true) {
    console.warn(
      `Warning: Solo mode with lockfile enabled is unusual.\n` +
      `  Consider using 'mode: team' if you need lockfile features.`
    )
  }
  
  if (config.mode === 'solo' && config.modules?.bundle === true) {
    console.warn(
      `Warning: Solo mode with bundle enabled is unusual.\n` +
      `  Consider using 'mode: team' if you need bundle features.`
    )
  }
}

/**
 * Load and parse config file
 */
export async function loadConfig(configPath?: string): Promise<AlignTrueConfig> {
  const path = configPath || '.aligntrue/config.yaml'
  
  // Check file exists
  if (!existsSync(path)) {
    throw new Error(
      `Config file not found: ${path}\n` +
      `  Run 'aligntrue init' to create one.`
    )
  }
  
  // Parse YAML
  let content: string
  let config: unknown
  
  try {
    content = readFileSync(path, 'utf8')
  } catch (err) {
    throw new Error(
      `Failed to read config file: ${path}\n` +
      `  ${err instanceof Error ? err.message : String(err)}`
    )
  }
  
  try {
    config = yaml.load(content)
  } catch (err) {
    const yamlErr = err as { mark?: { line?: number; column?: number } }
    const location = yamlErr.mark 
      ? ` at line ${yamlErr.mark.line! + 1}, column ${yamlErr.mark.column! + 1}`
      : ''
    
    throw new Error(
      `Invalid YAML in ${path}${location}\n` +
      `  ${err instanceof Error ? err.message : String(err)}\n` +
      `  Check for syntax errors (indentation, quotes, colons).`
    )
  }
  
  // Validate against JSON Schema
  const schemaValidation = validateConfigSchema(config)
  if (!schemaValidation.valid) {
    throw new Error(
      `Invalid config in ${path}:\n${formatValidationErrors(schemaValidation.errors)}\n` +
      `  See config.schema.json for full specification.`
    )
  }
  
  // Cast to config type (safe after schema validation)
  const typedConfig = config as AlignTrueConfig
  
  // Apply defaults
  const configWithDefaults = applyDefaults(typedConfig)
  
  // Run enhanced validation (scopes, paths, cross-field checks)
  await validateConfig(configWithDefaults, path)
  
  return configWithDefaults
}
