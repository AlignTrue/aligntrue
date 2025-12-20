/**
 * Connector cursor/backfill skeleton contracts (A8 baseline expectations).
 * DR references: connector cursors, backfill semantics, schema drift hooks.
 */
export interface ConnectorManifest {
  name: string;
  version: string;
  capabilities?: string[];
  supportedEntities?: string[];
}

export interface CursorState {
  cursor: string | null;
  lastSyncedAt?: string;
}

export interface BackfillConfig {
  start?: string;
  end?: string;
  chunkSize?: number;
}

export interface SyncStats {
  recordsRead?: number;
  recordsWritten?: number;
  batches?: number;
}

export interface SyncContext {
  manifest: ConnectorManifest;
  state: CursorState;
  backfill?: BackfillConfig;
}

export interface SyncResult {
  nextState: CursorState;
  stats?: SyncStats;
}
