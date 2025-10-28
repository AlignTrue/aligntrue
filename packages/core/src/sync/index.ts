/**
 * Two-way sync engine: IR ↔ agents
 * Default: IR → agent; explicit --accept-agent for pullback
 */

import { SyncEngine } from './engine.js'

export type { SyncOptions, SyncResult } from './engine.js'
export type { Conflict } from './conflict-detector.js'
export { SyncEngine } from './engine.js'
export { ConflictDetector } from './conflict-detector.js'
export { AtomicFileWriter, computeFileChecksum, computeContentChecksum, ensureDirectoryExists } from './file-operations.js'
export { loadIR } from './ir-loader.js'
export { importFromAgent, canImportFromAgent, getImportSourcePath } from './import.js'

// Global sync engine instance for convenience functions
const globalEngine = new SyncEngine()

/**
 * Sync IR to agents (default direction)
 * Convenience wrapper around SyncEngine.syncToAgents
 */
export async function syncToAgents(
  irPath: string,
  options: Parameters<SyncEngine['syncToAgents']>[1] = {}
): Promise<ReturnType<SyncEngine['syncToAgents']>> {
  return globalEngine.syncToAgents(irPath, options)
}

/**
 * Sync from agent to IR (pullback direction)
 * Convenience wrapper around SyncEngine.syncFromAgent
 */
export async function syncFromAgent(
  agent: string,
  irPath: string,
  options: Parameters<SyncEngine['syncFromAgent']>[2] = {}
): Promise<ReturnType<SyncEngine['syncFromAgent']>> {
  return globalEngine.syncFromAgent(agent, irPath, options)
}

/**
 * Register an exporter with the global sync engine
 */
export function registerExporter(exporter: Parameters<SyncEngine['registerExporter']>[0]): void {
  globalEngine.registerExporter(exporter)
}

