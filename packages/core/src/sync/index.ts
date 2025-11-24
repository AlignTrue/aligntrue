/**
 * Two-way sync engine: IR ↔ agents
 * Default: IR → agent; explicit --accept-agent for pullback
 */

import { SyncEngine } from "./engine.js";

export type { SyncOptions, SyncResult } from "./engine.js";
export { SyncEngine } from "./engine.js";
export {
  AtomicFileWriter,
  computeFileChecksum,
  computeContentChecksum,
  ensureDirectoryExists,
} from "@aligntrue/file-utils";
export { loadIR, saveIR } from "./ir-loader.js";
export {
  discoverSourceFiles,
  orderSourceFiles,
  mergeSourceFiles,
  loadSourceFiles,
} from "./source-loader.js";
export type { SourceFile } from "./source-loader.js";
export {
  getLastSyncTimestamp,
  updateLastSyncTimestamp,
  wasFileModifiedSince,
  getFileModificationTime,
  storeAgentExportHash,
  getAgentExportHashes,
} from "./tracking.js";
export {
  loadDriftLog,
  saveDriftLog,
  addDriftDetection,
  updateDriftStatus,
  getPendingDetections,
  clearDetectionsByStatus,
  clearAllDetections,
  type DriftLog,
  type DriftDetection,
  type DriftStatus,
} from "./drift-detection.js";

// Global sync engine instance for convenience functions
const globalEngine = new SyncEngine();

/**
 * Sync IR to agents (default direction)
 * Convenience wrapper around SyncEngine.syncToAgents
 */
export async function syncToAgents(
  irPath: string,
  options: Parameters<SyncEngine["syncToAgents"]>[1] = {},
): Promise<ReturnType<SyncEngine["syncToAgents"]>> {
  return globalEngine.syncToAgents(irPath, options);
}

/**
 * Sync from agent to IR (pullback direction)
 * Convenience wrapper around SyncEngine.syncFromAgent
 */
export async function syncFromAgent(
  agent: string,
  irPath: string,
  options: Parameters<SyncEngine["syncFromAgent"]>[2] = {},
): Promise<ReturnType<SyncEngine["syncFromAgent"]>> {
  return globalEngine.syncFromAgent(agent, irPath, options);
}

/**
 * Register an exporter with the global sync engine
 */
export function registerExporter(
  exporter: Parameters<SyncEngine["registerExporter"]>[0],
): void {
  globalEngine.registerExporter(exporter);
}
