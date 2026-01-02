/**
 * Connector lifecycle hooks (stub) for incremental and backfill sync.
 * Aligns with DR-008 (sharing posture) and connector cursor contracts.
 */
import { SyncContext, SyncResult } from "./types.js";

export async function runIncrementalSync(
  context: SyncContext,
): Promise<SyncResult> {
  return { nextState: context.state };
}

export async function runBackfill(context: SyncContext): Promise<SyncResult> {
  return { nextState: context.state };
}
