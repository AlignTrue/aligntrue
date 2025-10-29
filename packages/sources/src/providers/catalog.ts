/**
 * Catalog source provider - fetches packs from AlignTrue/aligns GitHub repository
 * 
 * Strategy:
 * - Fetches catalog/index.json first to validate pack ID exists
 * - Then fetches individual pack YAML from GitHub raw URLs
 * - Caches indefinitely in .aligntrue/.cache/catalog/
 * - Falls back to cache when network unavailable
 * - Supports forceRefresh option to bypass cache
 * 
 * Privacy:
 * - Requires user consent before first catalog fetch
 * - Respects offline mode (uses cache only, no network)
 * - Clear error messages when consent denied
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import type { SourceProvider } from './index.js'
import type { ConsentManager } from '@aligntrue/core'

/**
 * GitHub configuration for AlignTrue/aligns repository
 */
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/AlignTrue/aligns/main'
const CATALOG_INDEX_URL = `${GITHUB_RAW_BASE}/catalog/index.json`

/**
 * Pack ID pattern validation (e.g., "packs/base/base-global")
 * Must match: packs/<category>/<pack-name>
 */
const PACK_ID_PATTERN = /^packs\/[a-z0-9-]+\/[a-z0-9-]+$/

/**
 * Catalog index entry
 */
export interface CatalogEntry {
  id: string
  version: string
  profile?: {
    id?: string
    url?: string
  }
  summary?: string
  tags?: string[]
  content_sha256?: string
}

/**
 * Catalog index structure
 */
export interface CatalogIndex {
  version: string
  packs: CatalogEntry[]
}

/**
 * Options for catalog provider
 */
export interface CatalogProviderOptions {
  cacheDir: string
  forceRefresh?: boolean
  warnOnStaleCache?: boolean
  offlineMode?: boolean
  consentManager?: ConsentManager
}

/**
 * Catalog provider implementation
 */
export class CatalogProvider implements SourceProvider {
  type = 'catalog' as const
  private cacheDir: string
  private forceRefresh: boolean
  private warnOnStaleCache: boolean
  private offlineMode: boolean
  private consentManager?: ConsentManager

  constructor(options: CatalogProviderOptions) {
    this.cacheDir = options.cacheDir
    this.forceRefresh = options.forceRefresh ?? false
    this.warnOnStaleCache = options.warnOnStaleCache ?? true
    this.offlineMode = options.offlineMode ?? false
    if (options.consentManager !== undefined) {
      this.consentManager = options.consentManager
    }

    // Validate cache directory path (security check from Step 20)
    this.validateCachePath(this.cacheDir)

    // Ensure cache directory exists
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true })
    }
  }

  /**
   * Fetch a pack by ID (e.g., "packs/base/base-global")
   * 
   * Flow:
   * 1. Validate pack ID format
   * 2. Check cache (unless forceRefresh)
   * 3. Fetch index.json from GitHub
   * 4. Validate pack ID exists in index
   * 5. Fetch pack YAML from GitHub
   * 6. Cache result
   * 7. Return YAML content
   */
  async fetch(packId: string): Promise<string> {
    // Validate pack ID format and prevent path traversal
    this.validatePackId(packId)

    // Check cache first (unless forceRefresh)
    if (!this.forceRefresh) {
      const cached = this.getCachedPack(packId)
      if (cached) {
        if (this.warnOnStaleCache) {
          console.warn(`Using cached pack: ${packId} (use --force-refresh to update)`)
        }
        return cached
      }
    }

    // Offline mode: use cache only, no network operations
    if (this.offlineMode) {
      const cached = this.getCachedPack(packId)
      if (cached) {
        return cached
      }
      throw new Error(
        `Offline mode: no cache available for pack\n` +
        `  Pack: ${packId}\n` +
        `  Run without --offline to fetch from catalog`
      )
    }

    // Privacy consent check before network operation
    if (this.consentManager && !this.consentManager.checkConsent('catalog')) {
      throw new Error(
        `Network operation requires consent\n` +
        `  Pack: ${packId}\n` +
        `  Catalog: AlignTrue/aligns (GitHub)\n` +
        `  Grant consent with: aligntrue privacy grant catalog\n` +
        `  Or run with --offline to use cache only`
      )
    }

    try {
      // Fetch and validate pack exists in catalog index
      const index = await this.fetchCatalogIndex()
      const entry = index.packs.find(p => p.id === packId)
      
      if (!entry) {
        throw new Error(
          `Pack not found in catalog: ${packId}\n` +
          `  Available packs: ${index.packs.map(p => p.id).join(', ')}`
        )
      }

      // Fetch pack YAML from GitHub
      const packYaml = await this.fetchPackYaml(packId)

      // Cache the result
      this.writeCachePack(packId, packYaml)

      return packYaml
    } catch (error) {
      // Network error - try cache fallback
      if (this.isNetworkError(error)) {
        const cached = this.getCachedPack(packId)
        if (cached) {
          console.warn(
            `Network unavailable, using cached pack: ${packId}\n` +
            `  Cache may be stale. Will retry on next sync.`
          )
          return cached
        }

        // No cache available
        throw new Error(
          `Failed to fetch pack ${packId} and no cache available\n` +
          `  Network error: ${error instanceof Error ? error.message : String(error)}\n` +
          `  Check your internet connection or try again later.`
        )
      }

      // Not a network error, rethrow
      throw error
    }
  }

  /**
   * Fetch catalog index from GitHub with cache fallback
   */
  private async fetchCatalogIndex(): Promise<CatalogIndex> {
    // Try cache first (unless forceRefresh)
    if (!this.forceRefresh) {
      const cached = this.getCachedIndex()
      if (cached) {
        return cached
      }
    }

    // Fetch from GitHub
    try {
      const response = await fetch(CATALOG_INDEX_URL)
      
      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}`
        )
      }

      const text = await response.text()
      const index = JSON.parse(text) as CatalogIndex

      // Validate index structure
      if (!index.version || !Array.isArray(index.packs)) {
        throw new Error(
          `Invalid catalog index structure\n` +
          `  Expected: { version: string, packs: CatalogEntry[] }`
        )
      }

      // Cache the index
      this.writeCacheIndex(index)

      return index
    } catch (error) {
      // Try cache fallback on network error
      if (this.isNetworkError(error)) {
        const cached = this.getCachedIndex()
        if (cached) {
          console.warn(
            `Network unavailable, using cached catalog index\n` +
            `  Cache may be stale. Will retry on next sync.`
          )
          return cached
        }
      }

      throw error
    }
  }

  /**
   * Fetch pack YAML from GitHub by ID
   */
  private async fetchPackYaml(packId: string): Promise<string> {
    // Construct URL: https://raw.githubusercontent.com/AlignTrue/aligns/main/packs/base/base-global.yaml
    const packUrl = `${GITHUB_RAW_BASE}/${packId}.yaml`

    try {
      const response = await fetch(packUrl)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            `Pack YAML not found: ${packId}\n` +
            `  URL: ${packUrl}\n` +
            `  The pack may have been removed or renamed.`
          )
        }

        throw new Error(
          `HTTP ${response.status}: ${response.statusText}\n` +
          `  URL: ${packUrl}`
        )
      }

      const yaml = await response.text()

      // Basic validation that it looks like YAML
      if (!yaml || yaml.trim().length === 0) {
        throw new Error(
          `Empty YAML content for pack: ${packId}\n` +
          `  URL: ${packUrl}`
        )
      }

      return yaml
    } catch (error) {
      // Add context to error
      if (error instanceof Error && !error.message.includes(packUrl)) {
        throw new Error(
          `Failed to fetch pack YAML: ${packId}\n` +
          `  URL: ${packUrl}\n` +
          `  ${error.message}`
        )
      }

      throw error
    }
  }

  /**
   * Read cached catalog index
   */
  private getCachedIndex(): CatalogIndex | null {
    const indexPath = join(this.cacheDir, 'index.json')

    if (!existsSync(indexPath)) {
      return null
    }

    try {
      const content = readFileSync(indexPath, 'utf-8')
      const index = JSON.parse(content) as CatalogIndex

      // Basic validation
      if (!index.version || !Array.isArray(index.packs)) {
        console.warn(`Corrupted cache index, will refetch: ${indexPath}`)
        return null
      }

      return index
    } catch (error) {
      console.warn(
        `Failed to read cache index: ${indexPath}\n` +
        `  ${error instanceof Error ? error.message : String(error)}`
      )
      return null
    }
  }

  /**
   * Read cached pack YAML
   */
  private getCachedPack(packId: string): string | null {
    // Sanitize pack ID for filesystem (already validated by validatePackId)
    const packPath = join(this.cacheDir, `${packId}.yaml`)

    if (!existsSync(packPath)) {
      return null
    }

    try {
      return readFileSync(packPath, 'utf-8')
    } catch (error) {
      console.warn(
        `Failed to read cached pack: ${packId}\n` +
        `  ${error instanceof Error ? error.message : String(error)}`
      )
      return null
    }
  }

  /**
   * Write catalog index to cache atomically
   */
  private writeCacheIndex(index: CatalogIndex): void {
    const indexPath = join(this.cacheDir, 'index.json')
    const tempPath = `${indexPath}.tmp`

    try {
      // Ensure directory exists
      const dir = dirname(indexPath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      // Write to temp file
      writeFileSync(tempPath, JSON.stringify(index, null, 2), 'utf-8')

      // Atomic rename
      if (existsSync(indexPath)) {
        // On Windows, we need to remove the target file first
        if (process.platform === 'win32') {
          const backup = `${indexPath}.backup`
          if (existsSync(backup)) {
            writeFileSync(backup, readFileSync(indexPath, 'utf-8'), 'utf-8')
          }
        }
      }

      // Use fs.renameSync which is atomic on POSIX systems
      const { renameSync } = require('fs')
      renameSync(tempPath, indexPath)
    } catch (error) {
      // Clean up temp file on error
      try {
        if (existsSync(tempPath)) {
          const { unlinkSync } = require('fs')
          unlinkSync(tempPath)
        }
      } catch {
        // Ignore cleanup errors
      }

      throw new Error(
        `Failed to write cache index\n` +
        `  ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Write pack YAML to cache atomically
   */
  private writeCachePack(packId: string, yaml: string): void {
    const packPath = join(this.cacheDir, `${packId}.yaml`)
    const tempPath = `${packPath}.tmp`

    try {
      // Ensure directory exists (handles nested pack IDs like packs/base/base-global)
      const dir = dirname(packPath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      // Write to temp file
      writeFileSync(tempPath, yaml, 'utf-8')

      // Atomic rename
      if (existsSync(packPath)) {
        // On Windows, we need to handle the target file first
        if (process.platform === 'win32') {
          const backup = `${packPath}.backup`
          if (existsSync(backup)) {
            writeFileSync(backup, readFileSync(packPath, 'utf-8'), 'utf-8')
          }
        }
      }

      // Use fs.renameSync which is atomic on POSIX systems
      const { renameSync } = require('fs')
      renameSync(tempPath, packPath)
    } catch (error) {
      // Clean up temp file on error
      try {
        if (existsSync(tempPath)) {
          const { unlinkSync } = require('fs')
          unlinkSync(tempPath)
        }
      } catch {
        // Ignore cleanup errors
      }

      throw new Error(
        `Failed to write cached pack: ${packId}\n` +
        `  ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Validate pack ID format and prevent path traversal
   */
  private validatePackId(packId: string): void {
    // Check for path traversal attempts
    if (packId.includes('..') || packId.includes('\\')) {
      throw new Error(
        `Invalid pack ID: ${packId}\n` +
        `  Pack IDs cannot contain '..' or backslashes`
      )
    }

    // Check for absolute paths
    if (packId.startsWith('/') || /^[A-Za-z]:/.test(packId)) {
      throw new Error(
        `Invalid pack ID: ${packId}\n` +
        `  Pack IDs must be relative paths (e.g., "packs/base/base-global")`
      )
    }

    // Validate format matches expected pattern
    if (!PACK_ID_PATTERN.test(packId)) {
      throw new Error(
        `Invalid pack ID format: ${packId}\n` +
        `  Expected format: packs/<category>/<pack-name>\n` +
        `  Example: packs/base/base-global`
      )
    }
  }

  /**
   * Validate cache directory path (security check from Step 20)
   */
  private validateCachePath(cachePath: string): void {
    // Check for path traversal attempts
    if (cachePath.includes('..')) {
      throw new Error(
        `Invalid cache path: ${cachePath}\n` +
        `  Cache paths cannot contain '..' (parent directory traversal)`
      )
    }

    // Check for absolute paths (must be relative to workspace)
    if (cachePath.startsWith('/') || /^[A-Za-z]:/.test(cachePath)) {
      throw new Error(
        `Invalid cache path: ${cachePath}\n` +
        `  Cache paths must be relative to workspace root`
      )
    }
  }

  /**
   * Check if error is a network error (for cache fallback logic)
   */
  private isNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false
    }

    const message = error.message.toLowerCase()

    // Common network error indicators
    return (
      message.includes('fetch') ||
      message.includes('network') ||
      message.includes('enotfound') ||
      message.includes('econnrefused') ||
      message.includes('etimedout') ||
      message.includes('socket') ||
      message.includes('http') && message.includes('5')
    )
  }
}
