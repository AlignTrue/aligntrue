import { readFileSync, existsSync } from 'fs'
import { join, resolve, isAbsolute } from 'path'
import type { SourceProvider } from './index.js'

export class LocalProvider implements SourceProvider {
  type = 'local' as const
  private normalizedBasePath: string
  
  constructor(basePath: string) {
    // Normalize to absolute path
    this.normalizedBasePath = isAbsolute(basePath) ? basePath : resolve(process.cwd(), basePath)
  }
  
  async fetch(ref: string): Promise<string> {
    // Prevent path traversal attacks
    if (ref.includes('..')) {
      throw new Error(`Invalid reference: path traversal not allowed: ${ref}`)
    }
    
    const fullPath = join(this.normalizedBasePath, ref)
    
    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`)
    }
    
    try {
      return readFileSync(fullPath, 'utf-8')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to read file ${fullPath}: ${message}`)
    }
  }
}

