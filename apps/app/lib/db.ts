import Database from "better-sqlite3";
import path from "node:path";
import { ensureDirectoryExists } from "@aligntrue/file-utils";

export type PlanStatus = "approved" | "pending_approval" | "rejected";

const DB_PATH = path.join(process.cwd(), "data", "ui.db");

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
ensureDirectoryExists(dataDir);

export const db = new Database(DB_PATH);

// Enable WAL for better concurrency on local
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS plans (
    plan_id TEXT PRIMARY KEY,
    core TEXT NOT NULL,
    meta TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
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
`);

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
