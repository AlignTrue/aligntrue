/**
 * In-memory file provider for testing
 */

import { minimatch } from 'minimatch'
import type { FileProvider, GlobOptions } from '../../src/types.js'

/**
 * In-memory file provider for deterministic testing
 */
export class MemoryFileProvider implements FileProvider {
  private files: Map<string, string> = new Map()

  /**
   * Add a file to the in-memory filesystem
   */
  addFile(path: string, content: string): void {
    this.files.set(path, content)
  }

  /**
   * Add multiple files at once
   */
  addFiles(files: Record<string, string>): void {
    for (const [path, content] of Object.entries(files)) {
      this.addFile(path, content)
    }
  }

  async glob(pattern: string, options?: GlobOptions): Promise<string[]> {
    const paths = Array.from(this.files.keys())
    const ignore = options?.ignore || []

    return paths.filter(path => {
      // Check if path matches pattern
      if (!minimatch(path, pattern)) {
        return false
      }

      // Check if path matches any ignore pattern
      for (const ignorePattern of ignore) {
        if (minimatch(path, ignorePattern)) {
          return false
        }
      }

      return true
    })
  }

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path)
    if (content === undefined) {
      throw new Error(`File not found: ${path}`)
    }
    return content
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path)
  }

  async readJson(path: string): Promise<unknown> {
    const content = await this.readFile(path)
    return JSON.parse(content)
  }
}

