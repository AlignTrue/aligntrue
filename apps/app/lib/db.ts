import "server-only";
import Database from "better-sqlite3";
import path from "node:path";
import { ensureDirectoryExists } from "@aligntrue/file-utils";

export type PlanStatus = "approved" | "pending_approval" | "rejected";

const DB_PATH = path.join(process.cwd(), "data", "ui.db");

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
ensureDirectoryExists(dataDir);

export const db = new Database(DB_PATH, {
  // Increase timeout to handle concurrent access during builds
  timeout: 10000,
});

// Enable WAL for better concurrency on local
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS plans (
    plan_id TEXT PRIMARY KEY,
    core TEXT NOT NULL,
    meta TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  -- Stored plan artifacts for deterministic serving
  CREATE TABLE IF NOT EXISTS plan_artifacts (
    plan_id TEXT PRIMARY KEY,
    compiled_plan_json TEXT NOT NULL,
    render_request_json TEXT NOT NULL,
    render_plan_json TEXT NOT NULL,
    render_request_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  -- Receipt metadata (idempotent)
  CREATE TABLE IF NOT EXISTS plan_receipts (
    receipt_id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    mode TEXT NOT NULL,
    workspace_id TEXT,
    occurred_at TEXT NOT NULL,
    ingested_at TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT,
    ai_failed INTEGER,
    ai_failed_reason TEXT,
    policy_id TEXT NOT NULL,
    policy_version TEXT NOT NULL,
    policy_hash TEXT NOT NULL,
    policy_stage TEXT NOT NULL,
    compiler_version TEXT NOT NULL,
    context_hash TEXT NOT NULL,
    layout_intent_core_hash TEXT,
    render_request_hash TEXT NOT NULL,
    causation_id TEXT,
    causation_type TEXT,
    actor_id TEXT NOT NULL,
    actor_type TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS plan_served_events (
    event_id TEXT PRIMARY KEY,
    receipt_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    workspace_id TEXT,
    served_at TEXT NOT NULL,
    correlation_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_type TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS plan_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    plan_id TEXT,
    idempotency_key TEXT,
    receipt_id TEXT,
    occurred_at TEXT NOT NULL,
    details_json TEXT
  );

  CREATE TABLE IF NOT EXISTS ui_state (
    plan_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    PRIMARY KEY (plan_id, version)
  );

  CREATE TABLE IF NOT EXISTS action_sequence (
    plan_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    last_sequence INTEGER NOT NULL,
    PRIMARY KEY (plan_id, actor_id)
  );

  CREATE TABLE IF NOT EXISTS processed_actions (
    plan_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    action_id TEXT NOT NULL,
    status TEXT NOT NULL, -- "pending" | "completed" | "failed"
    state_version INTEGER,
    result_json TEXT, -- envelope preview or outcome summary
    errors_json TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (plan_id, actor_id, idempotency_key)
  );

  CREATE TABLE IF NOT EXISTS plan_debug (
    plan_id TEXT PRIMARY KEY,
    render_request_json TEXT,
    validation_errors_json TEXT,
    manifests_hash TEXT,
    context_hash TEXT,
    attempts INTEGER,
    created_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_receipts_plan_id ON plan_receipts (plan_id);
  CREATE INDEX IF NOT EXISTS idx_plan_events_type ON plan_events (event_type);
  CREATE INDEX IF NOT EXISTS idx_served_events_receipt ON plan_served_events (receipt_id);
`);

// Generic transaction helper for SQLite (serializes writers)
export function runInTransaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes("UNIQUE constraint failed")
  );
}

// Plan artifacts
export interface PlanArtifact {
  readonly plan_id: string;
  readonly compiled_plan_json: string;
  readonly render_request_json: string;
  readonly render_plan_json: string;
  readonly render_request_hash: string;
  readonly created_at: string;
}

export function insertPlanArtifact(params: PlanArtifact): void {
  db.prepare(
    `INSERT OR IGNORE INTO plan_artifacts
     (plan_id, compiled_plan_json, render_request_json, render_plan_json, render_request_hash, created_at)
     VALUES (@plan_id, @compiled_plan_json, @render_request_json, @render_plan_json, @render_request_hash, @created_at)`,
  ).run(params);
}

export function getPlanArtifact(plan_id: string): PlanArtifact | null {
  const row = db
    .prepare(
      `SELECT plan_id, compiled_plan_json, render_request_json, render_plan_json, render_request_hash, created_at
       FROM plan_artifacts WHERE plan_id = ?`,
    )
    .get(plan_id) as PlanArtifact | undefined;
  return row ?? null;
}

// Plan receipts
export interface DbPlanReceipt {
  readonly receipt_id: string;
  readonly plan_id: string;
  readonly idempotency_key: string;
  readonly mode: string;
  readonly workspace_id: string | null;
  readonly occurred_at: string;
  readonly ingested_at: string;
  readonly provider: string;
  readonly model: string | null;
  readonly ai_failed: number | null;
  readonly ai_failed_reason: string | null;
  readonly policy_id: string;
  readonly policy_version: string;
  readonly policy_hash: string;
  readonly policy_stage: string;
  readonly compiler_version: string;
  readonly context_hash: string;
  readonly layout_intent_core_hash: string | null;
  readonly render_request_hash: string;
  readonly causation_id: string | null;
  readonly causation_type: string | null;
  readonly actor_id: string;
  readonly actor_type: string;
}

export function insertPlanReceipt(row: DbPlanReceipt): void {
  db.prepare(
    `INSERT INTO plan_receipts (
      receipt_id, plan_id, idempotency_key, mode, workspace_id,
      occurred_at, ingested_at, provider, model, ai_failed, ai_failed_reason,
      policy_id, policy_version, policy_hash, policy_stage, compiler_version,
      context_hash, layout_intent_core_hash, render_request_hash,
      causation_id, causation_type, actor_id, actor_type
    ) VALUES (
      @receipt_id, @plan_id, @idempotency_key, @mode, @workspace_id,
      @occurred_at, @ingested_at, @provider, @model, @ai_failed, @ai_failed_reason,
      @policy_id, @policy_version, @policy_hash, @policy_stage, @compiler_version,
      @context_hash, @layout_intent_core_hash, @render_request_hash,
      @causation_id, @causation_type, @actor_id, @actor_type
    )`,
  ).run({
    ...row,
    workspace_id: row.workspace_id ?? null,
    model: row.model ?? null,
    ai_failed_reason: row.ai_failed_reason ?? null,
    layout_intent_core_hash: row.layout_intent_core_hash ?? null,
    causation_id: row.causation_id ?? null,
    causation_type: row.causation_type ?? null,
  });
}

export function getReceiptByIdempotencyKey(
  idempotency_key: string,
): DbPlanReceipt | null {
  const row = db
    .prepare(`SELECT * FROM plan_receipts WHERE idempotency_key = ?`)
    .get(idempotency_key) as DbPlanReceipt | undefined;
  return row ?? null;
}

// Plan served events
export interface PlanServedEventRow {
  readonly event_id: string;
  readonly receipt_id: string;
  readonly plan_id: string;
  readonly idempotency_key: string;
  readonly workspace_id: string | null;
  readonly served_at: string;
  readonly correlation_id: string;
  readonly actor_id: string;
  readonly actor_type: string;
}

export function insertPlanServedEvent(row: PlanServedEventRow): void {
  db.prepare(
    `INSERT INTO plan_served_events
     (event_id, receipt_id, plan_id, idempotency_key, workspace_id, served_at, correlation_id, actor_id, actor_type)
     VALUES (@event_id, @receipt_id, @plan_id, @idempotency_key, @workspace_id, @served_at, @correlation_id, @actor_id, @actor_type)`,
  ).run({ ...row, workspace_id: row.workspace_id ?? null });
}

// Plan events (diagnostics)
export interface PlanEventRow {
  readonly event_id: string;
  readonly event_type: string;
  readonly plan_id: string | null;
  readonly idempotency_key: string | null;
  readonly receipt_id: string | null;
  readonly occurred_at: string;
  readonly details_json: string | null;
}

export function insertPlanEvent(row: PlanEventRow): void {
  db.prepare(
    `INSERT INTO plan_events
     (event_id, event_type, plan_id, idempotency_key, receipt_id, occurred_at, details_json)
     VALUES (@event_id, @event_type, @plan_id, @idempotency_key, @receipt_id, @occurred_at, @details_json)`,
  ).run(row);
}

// Plans
export function upsertPlan(params: {
  plan_id: string;
  core: unknown;
  meta: unknown;
  status: PlanStatus;
  created_at: string;
}): void {
  const stmt = db.prepare(`
    INSERT INTO plans (plan_id, core, meta, status, created_at)
    VALUES (@plan_id, @core, @meta, @status, @created_at)
    ON CONFLICT(plan_id) DO UPDATE SET
      core = excluded.core,
      meta = excluded.meta,
      status = excluded.status,
      created_at = excluded.created_at
  `);
  stmt.run({
    plan_id: params.plan_id,
    core: JSON.stringify(params.core),
    meta: JSON.stringify(params.meta),
    status: params.status,
    created_at: params.created_at,
  });
}

export function getPlan(plan_id: string): {
  plan_id: string;
  core: unknown;
  meta: unknown;
  status: PlanStatus;
} | null {
  const row = db
    .prepare(`SELECT plan_id, core, meta, status FROM plans WHERE plan_id = ?`)
    .get(plan_id) as
    | { plan_id: string; core: string; meta: string; status: PlanStatus }
    | undefined;
  if (!row) return null;
  return {
    plan_id: row.plan_id,
    core: JSON.parse(row.core),
    meta: JSON.parse(row.meta),
    status: row.status,
  };
}

export function updatePlanStatus(plan_id: string, status: PlanStatus): void {
  db.prepare(`UPDATE plans SET status = ? WHERE plan_id = ?`).run(
    status,
    plan_id,
  );
}

// UI State
export function getLatestState(
  plan_id: string,
): { version: number; content: unknown; content_hash: string } | null {
  const row = db
    .prepare(
      `SELECT version, content, content_hash FROM ui_state WHERE plan_id = ? ORDER BY version DESC LIMIT 1`,
    )
    .get(plan_id) as
    | { version: number; content: string; content_hash: string }
    | undefined;
  if (!row) return null;
  return {
    version: row.version,
    content: JSON.parse(row.content),
    content_hash: row.content_hash,
  };
}

export function getStateVersion(
  plan_id: string,
  version: number,
): { version: number; content: unknown; content_hash: string } | null {
  const row = db
    .prepare(
      `SELECT version, content, content_hash FROM ui_state WHERE plan_id = ? AND version = ?`,
    )
    .get(plan_id, version) as
    | { version: number; content: string; content_hash: string }
    | undefined;
  if (!row) return null;
  return {
    version: row.version,
    content: JSON.parse(row.content),
    content_hash: row.content_hash,
  };
}

export function insertState(params: {
  plan_id: string;
  version: number;
  content: unknown;
  content_hash: string;
}): void {
  const stmt = db.prepare(
    `INSERT INTO ui_state (plan_id, version, content, content_hash) VALUES (@plan_id, @version, @content, @content_hash)`,
  );
  stmt.run({
    plan_id: params.plan_id,
    version: params.version,
    content: JSON.stringify(params.content),
    content_hash: params.content_hash,
  });
}

// Action sequencing
export function getActionSequence(plan_id: string, actor_id: string): number {
  const row = db
    .prepare(
      `SELECT last_sequence FROM action_sequence WHERE plan_id = ? AND actor_id = ?`,
    )
    .get(plan_id, actor_id) as { last_sequence: number } | undefined;
  return row?.last_sequence ?? 0;
}

export function updateActionSequence(
  plan_id: string,
  actor_id: string,
  last_sequence: number,
): void {
  db.prepare(
    `INSERT INTO action_sequence (plan_id, actor_id, last_sequence)
     VALUES (?, ?, ?)
     ON CONFLICT(plan_id, actor_id) DO UPDATE SET last_sequence = excluded.last_sequence`,
  ).run(plan_id, actor_id, last_sequence);
}

// Processed actions (idempotency)
export interface ProcessedAction {
  readonly plan_id: string;
  readonly actor_id: string;
  readonly idempotency_key: string;
  readonly action_id: string;
  readonly status: "pending" | "completed" | "failed";
  readonly state_version: number | null;
  readonly result_json: unknown;
  readonly errors_json: unknown;
  readonly created_at: string;
}

export function getProcessedAction(
  plan_id: string,
  actor_id: string,
  idempotency_key: string,
): ProcessedAction | null {
  const row = db
    .prepare(
      `SELECT plan_id, actor_id, idempotency_key, action_id, status, state_version, result_json, errors_json, created_at
       FROM processed_actions WHERE plan_id = ? AND actor_id = ? AND idempotency_key = ?`,
    )
    .get(plan_id, actor_id, idempotency_key) as
    | {
        plan_id: string;
        actor_id: string;
        idempotency_key: string;
        action_id: string;
        status: "pending" | "completed" | "failed";
        state_version: number | null;
        result_json: string | null;
        errors_json: string | null;
        created_at: string;
      }
    | undefined;
  if (!row) return null;
  return {
    plan_id: row.plan_id,
    actor_id: row.actor_id,
    idempotency_key: row.idempotency_key,
    action_id: row.action_id,
    status: row.status,
    state_version: row.state_version ?? null,
    result_json: row.result_json ? JSON.parse(row.result_json) : null,
    errors_json: row.errors_json ? JSON.parse(row.errors_json) : null,
    created_at: row.created_at,
  };
}

export function getPendingActionRaw(
  plan_id: string,
  actor_id: string,
): ProcessedAction | null {
  const row = db
    .prepare(
      `SELECT plan_id, actor_id, idempotency_key, action_id, status, state_version, result_json, errors_json, created_at
       FROM processed_actions
       WHERE plan_id = ? AND actor_id = ? AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(plan_id, actor_id) as
    | {
        plan_id: string;
        actor_id: string;
        idempotency_key: string;
        action_id: string;
        status: "pending" | "completed" | "failed";
        state_version: number | null;
        result_json: string | null;
        errors_json: string | null;
        created_at: string;
      }
    | undefined;

  if (!row) return null;
  return {
    plan_id: row.plan_id,
    actor_id: row.actor_id,
    idempotency_key: row.idempotency_key,
    action_id: row.action_id,
    status: row.status,
    state_version: row.state_version ?? null,
    result_json: row.result_json ? JSON.parse(row.result_json) : null,
    errors_json: row.errors_json ? JSON.parse(row.errors_json) : null,
    created_at: row.created_at,
  };
}

export function insertProcessedAction(params: {
  plan_id: string;
  actor_id: string;
  idempotency_key: string;
  action_id: string;
  status: "pending" | "completed" | "failed";
  state_version?: number | null;
  result_json?: unknown;
  errors_json?: unknown;
  created_at: string;
}): void {
  db.prepare(
    `INSERT INTO processed_actions (plan_id, actor_id, idempotency_key, action_id, status, state_version, result_json, errors_json, created_at)
     VALUES (@plan_id, @actor_id, @idempotency_key, @action_id, @status, @state_version, @result_json, @errors_json, @created_at)
     ON CONFLICT(plan_id, actor_id, idempotency_key) DO UPDATE SET
       action_id = excluded.action_id,
       status = excluded.status,
       state_version = excluded.state_version,
       result_json = excluded.result_json,
       errors_json = excluded.errors_json,
       created_at = excluded.created_at`,
  ).run({
    plan_id: params.plan_id,
    actor_id: params.actor_id,
    idempotency_key: params.idempotency_key,
    action_id: params.action_id,
    status: params.status,
    state_version: params.state_version ?? null,
    result_json: params.result_json ? JSON.stringify(params.result_json) : null,
    errors_json: params.errors_json ? JSON.stringify(params.errors_json) : null,
    created_at: params.created_at,
  });
}

export function finalizeProcessedAction(
  plan_id: string,
  actor_id: string,
  idempotency_key: string,
  params: {
    status: "completed" | "failed";
    state_version?: number | null;
    result_json?: unknown;
    errors_json?: unknown;
  },
): void {
  db.prepare(
    `UPDATE processed_actions
     SET status = @status,
         state_version = @state_version,
         result_json = @result_json,
         errors_json = @errors_json
     WHERE plan_id = @plan_id AND actor_id = @actor_id AND idempotency_key = @idempotency_key`,
  ).run({
    plan_id,
    actor_id,
    idempotency_key,
    status: params.status,
    state_version: params.state_version ?? null,
    result_json: params.result_json ? JSON.stringify(params.result_json) : null,
    errors_json: params.errors_json ? JSON.stringify(params.errors_json) : null,
  });
}

export function pruneProcessedActions(
  plan_id: string,
  actor_id: string,
  maxRows = 1000,
  ttlDays = 7,
): void {
  const cutoff = new Date(
    Date.now() - ttlDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  db.prepare(
    `DELETE FROM processed_actions WHERE plan_id = ? AND actor_id = ? AND created_at < ?`,
  ).run(plan_id, actor_id, cutoff);

  const countRow = db
    .prepare(
      `SELECT COUNT(*) as cnt FROM processed_actions WHERE plan_id = ? AND actor_id = ?`,
    )
    .get(plan_id, actor_id) as { cnt: number };
  if (countRow.cnt > maxRows) {
    const toDelete = countRow.cnt - maxRows;
    db.prepare(
      `DELETE FROM processed_actions
       WHERE rowid IN (
         SELECT rowid FROM processed_actions WHERE plan_id = ? AND actor_id = ?
         ORDER BY created_at ASC LIMIT ?
       )`,
    ).run(plan_id, actor_id, toDelete);
  }
}

// Plan debug artifacts
export interface PlanDebug {
  readonly plan_id: string;
  readonly render_request_json: unknown | null;
  readonly validation_errors_json: unknown | null;
  readonly manifests_hash: string | null;
  readonly context_hash: string | null;
  readonly attempts: number | null;
  readonly created_at: string;
}

export function insertPlanDebug(params: PlanDebug): void {
  const stmt = db.prepare(`
    INSERT INTO plan_debug (
      plan_id,
      render_request_json,
      validation_errors_json,
      manifests_hash,
      context_hash,
      attempts,
      created_at
    ) VALUES (@plan_id, @render_request_json, @validation_errors_json, @manifests_hash, @context_hash, @attempts, @created_at)
    ON CONFLICT(plan_id) DO UPDATE SET
      render_request_json = excluded.render_request_json,
      validation_errors_json = excluded.validation_errors_json,
      manifests_hash = excluded.manifests_hash,
      context_hash = excluded.context_hash,
      attempts = excluded.attempts,
      created_at = excluded.created_at
  `);

  stmt.run({
    plan_id: params.plan_id,
    render_request_json: params.render_request_json
      ? JSON.stringify(params.render_request_json)
      : null,
    validation_errors_json: params.validation_errors_json
      ? JSON.stringify(params.validation_errors_json)
      : null,
    manifests_hash: params.manifests_hash,
    context_hash: params.context_hash,
    attempts: params.attempts ?? null,
    created_at: params.created_at,
  });
}

export function getPlanDebug(plan_id: string): PlanDebug | null {
  const row = db
    .prepare(
      `SELECT plan_id, render_request_json, validation_errors_json, manifests_hash, context_hash, attempts, created_at FROM plan_debug WHERE plan_id = ?`,
    )
    .get(plan_id) as
    | {
        plan_id: string;
        render_request_json: string | null;
        validation_errors_json: string | null;
        manifests_hash: string | null;
        context_hash: string | null;
        attempts: number | null;
        created_at: string;
      }
    | undefined;

  if (!row) return null;
  return {
    plan_id: row.plan_id,
    render_request_json: row.render_request_json
      ? JSON.parse(row.render_request_json)
      : null,
    validation_errors_json: row.validation_errors_json
      ? JSON.parse(row.validation_errors_json)
      : null,
    manifests_hash: row.manifests_hash,
    context_hash: row.context_hash,
    attempts: row.attempts,
    created_at: row.created_at,
  };
}
