/**
 * Two-way sync engine: IR ↔ agents
 * Default: IR → agent; explicit --accept-agent for pullback
 */

export interface SyncOptions {
  acceptAgent?: string;
  dryRun?: boolean;
  backup?: boolean;
}

export interface SyncResult {
  success: boolean;
  conflicts?: Array<{ agent: string; field: string; irValue: unknown; agentValue: unknown }>;
  written: string[];
}

export async function syncToAgents(irPath: string, options: SyncOptions): Promise<SyncResult> {
  throw new Error('Not implemented');
}

export async function syncFromAgent(agent: string, irPath: string, options: SyncOptions): Promise<SyncResult> {
  throw new Error('Not implemented');
}

