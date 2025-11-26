/**
 * Unidirectional sync engine: .aligntrue/rules/*.md → agents
 *
 * The .aligntrue/rules/ directory is the single source of truth.
 * All sync operations flow outward to agent-specific formats.
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
export { loadIR, saveIR, loadIRAndResolvePlugs } from "./ir-loader.js";
export { orderSourceFiles, mergeSourceFiles } from "./source-loader.js";
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
export {
  cleanupOldExports,
  cleanupEmptyDirs,
  getAgentPatterns,
  agentHasExistingFiles,
  type CleanupResult,
} from "./cleanup.js";

// Global sync engine instance for convenience functions
const globalEngine = new SyncEngine();

/**
 * Sync rules to agents (unidirectional)
 * Reads from .aligntrue/rules/*.md, writes to agent-specific formats
 *
 * @param irPath Path to the IR source (for compatibility, will be ignored in favor of rules directory)
 * @param options Sync options
 */
export async function syncToAgents(
  irPath: string,
  options: Parameters<SyncEngine["syncToAgents"]>[1] = {},
): Promise<ReturnType<SyncEngine["syncToAgents"]>> {
  return globalEngine.syncToAgents(irPath, options);
}

/**
 * Register an exporter with the global sync engine
 */
export function registerExporter(
  exporter: Parameters<SyncEngine["registerExporter"]>[0],
): void {
  globalEngine.registerExporter(exporter);
}
