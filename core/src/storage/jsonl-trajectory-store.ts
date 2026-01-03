import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

import { OPS_DATA_DIR } from "../config.js";
import { ValidationError } from "../errors.js";
import type { TrajectoryEvent } from "../trajectories/envelope.js";
import type { OutcomeRecorded } from "../trajectories/outcome.js";
import type {
  TrajectoryStore,
  TrajectoryFilters,
  TrajectoryListOptions,
} from "./trajectory-store.js";

export const DEFAULT_TRAJECTORIES_PATH = `${OPS_DATA_DIR}/ops-core-trajectories.jsonl`;
export const DEFAULT_TRAJECTORY_OUTCOMES_PATH = `${OPS_DATA_DIR}/ops-core-outcomes.jsonl`;
export const DEFAULT_TRAJECTORY_DB_PATH = `${OPS_DATA_DIR}/ops-core-trajectories.db`;

interface JsonlTrajectoryStoreOpts {
  trajectoryPath?: string;
  outcomesPath?: string;
  dbPath?: string;
}

type Cursor = { offset: number };

export class JsonlTrajectoryStore implements TrajectoryStore {
  private readonly trajectoryPath: string;
  private readonly outcomesPath: string;
  private readonly db: Database.Database;

  constructor(opts?: JsonlTrajectoryStoreOpts) {
    this.trajectoryPath = resolve(
      opts?.trajectoryPath ?? DEFAULT_TRAJECTORIES_PATH,
    );
    this.outcomesPath = resolve(
      opts?.outcomesPath ?? DEFAULT_TRAJECTORY_OUTCOMES_PATH,
    );
    const dbPath = resolve(opts?.dbPath ?? DEFAULT_TRAJECTORY_DB_PATH);
    ensureDir(dirname(this.trajectoryPath));
    ensureDir(dirname(dbPath));
    this.db = new Database(dbPath);
    this.migrate();
  }

  private migrate() {
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS trajectory_steps (
          trajectory_id TEXT NOT NULL,
          step_seq INTEGER NOT NULL,
          step_id TEXT NOT NULL,
          step_type TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          entity_refs_json TEXT,
          command_id TEXT,
          jsonl_offset INTEGER NOT NULL,
          jsonl_len INTEGER NOT NULL
        )`,
      )
      .run();
    this.db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_traj_id ON trajectory_steps(trajectory_id)",
      )
      .run();
    this.db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_traj_time ON trajectory_steps(timestamp)",
      )
      .run();
    this.db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_traj_cmd ON trajectory_steps(command_id)",
      )
      .run();
    this.db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_traj_type ON trajectory_steps(step_type)",
      )
      .run();

    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS trajectory_outcomes (
          outcome_id TEXT PRIMARY KEY,
          trajectory_id TEXT,
          command_id TEXT,
          kind TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          jsonl_offset INTEGER NOT NULL,
          jsonl_len INTEGER NOT NULL
        )`,
      )
      .run();
    this.db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_outcome_traj ON trajectory_outcomes(trajectory_id)",
      )
      .run();
    this.db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_outcome_cmd ON trajectory_outcomes(command_id)",
      )
      .run();
    this.db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_outcome_time ON trajectory_outcomes(timestamp)",
      )
      .run();
  }

  async appendStep(step: TrajectoryEvent): Promise<void> {
    const line = JSON.stringify(step) + "\n";
    const offset = await fileSize(this.trajectoryPath);
    await fs.appendFile(this.trajectoryPath, line, "utf8");

    const entityRefs = step.refs?.entity_refs?.map((r) => r.ref) ?? [];
    this.db
      .prepare(
        `INSERT INTO trajectory_steps
         (trajectory_id, step_seq, step_id, step_type, timestamp, entity_refs_json, command_id, jsonl_offset, jsonl_len)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        step.trajectory_id,
        step.step_seq,
        step.step_id,
        step.step_type,
        step.timestamp,
        JSON.stringify(entityRefs),
        step.causation?.related_command_id ?? null,
        offset,
        Buffer.byteLength(line, "utf8"),
      );
  }

  async readTrajectory(trajectory_id: string): Promise<TrajectoryEvent[]> {
    const rows = this.db
      .prepare(
        `SELECT jsonl_offset, jsonl_len
         FROM trajectory_steps
         WHERE trajectory_id = ?
         ORDER BY step_seq ASC`,
      )
      .all(trajectory_id) as { jsonl_offset: number; jsonl_len: number }[];

    const events: TrajectoryEvent[] = [];
    for (const row of rows) {
      const evt = await readJsonAt<TrajectoryEvent>(
        this.trajectoryPath,
        row.jsonl_offset,
        row.jsonl_len,
      );
      events.push(evt);
    }
    return events;
  }

  async listTrajectories(
    opts: TrajectoryListOptions,
  ): Promise<{ ids: string[]; next_cursor?: string }> {
    const { filters, limit = 50, cursor, sort } = opts;
    const { where, params } = buildStepWhere(filters);

    const decoded = decodeCursor(cursor);
    const rows = this.db
      .prepare(
        `SELECT DISTINCT trajectory_id, timestamp, step_id
         FROM trajectory_steps
         ${where}
         ORDER BY timestamp ${sort === "time_asc" ? "ASC" : "DESC"}, step_id ASC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, decoded.offset) as { trajectory_id: string }[];

    const nextOffset = decoded.offset + rows.length;
    const next_cursor =
      rows.length === limit ? encodeCursor({ offset: nextOffset }) : undefined;

    return {
      ids: rows.map((r) => r.trajectory_id),
      ...(next_cursor ? { next_cursor } : {}),
    };
  }

  async appendOutcome(outcome: OutcomeRecorded): Promise<void> {
    const line = JSON.stringify(outcome) + "\n";
    const offset = await fileSize(this.outcomesPath);
    await fs.appendFile(this.outcomesPath, line, "utf8");

    this.db
      .prepare(
        `INSERT INTO trajectory_outcomes
         (outcome_id, trajectory_id, command_id, kind, timestamp, jsonl_offset, jsonl_len)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        outcome.outcome_id,
        outcome.attaches_to?.trajectory_id ?? null,
        outcome.attaches_to?.command_id ?? null,
        outcome.kind,
        outcome.timestamp,
        offset,
        Buffer.byteLength(line, "utf8"),
      );
  }

  async listOutcomes(opts: TrajectoryListOptions): Promise<{
    outcomes: OutcomeRecorded[];
    next_cursor?: string;
  }> {
    const { filters, limit = 50, cursor, sort } = opts;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.command_id) {
      conditions.push("command_id = ?");
      params.push(filters.command_id);
    }
    if (filters.time_after) {
      conditions.push("timestamp > ?");
      params.push(filters.time_after);
    }
    if (filters.time_before) {
      conditions.push("timestamp < ?");
      params.push(filters.time_before);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const decoded = decodeCursor(cursor);
    const rows = this.db
      .prepare(
        `SELECT jsonl_offset, jsonl_len
         FROM trajectory_outcomes
         ${where}
         ORDER BY timestamp ${sort === "time_asc" ? "ASC" : "DESC"}
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, decoded.offset) as {
      jsonl_offset: number;
      jsonl_len: number;
    }[];

    const outcomes: OutcomeRecorded[] = [];
    for (const row of rows) {
      const oc = await readJsonAt<OutcomeRecorded>(
        this.outcomesPath,
        row.jsonl_offset,
        row.jsonl_len,
      );
      outcomes.push(oc);
    }

    const nextOffset = decoded.offset + rows.length;
    const next_cursor =
      rows.length === limit ? encodeCursor({ offset: nextOffset }) : undefined;

    return {
      outcomes,
      ...(next_cursor ? { next_cursor } : {}),
    };
  }
}

function buildStepWhere(filters: TrajectoryFilters) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters.entity_ref) {
    conditions.push("entity_refs_json LIKE ?");
    params.push(`%${filters.entity_ref}%`);
  }
  if (filters.command_id) {
    conditions.push("command_id = ?");
    params.push(filters.command_id);
  }
  if (filters.step_types?.length) {
    conditions.push(
      `step_type IN (${filters.step_types.map(() => "?").join(",")})`,
    );
    params.push(...filters.step_types);
  }
  if (filters.time_after) {
    conditions.push("timestamp > ?");
    params.push(filters.time_after);
  }
  if (filters.time_before) {
    conditions.push("timestamp < ?");
    params.push(filters.time_before);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

async function fileSize(path: string): Promise<number> {
  try {
    const stat = await fs.stat(path);
    return stat.size;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw err;
  }
}

async function readJsonAt<T>(
  path: string,
  offset: number,
  length: number,
): Promise<T> {
  const fh = await fs.open(path, "r");
  try {
    const buffer = Buffer.alloc(length);
    await fh.read(buffer, 0, length, offset);
    return JSON.parse(buffer.toString("utf8")) as T;
  } finally {
    await fh.close();
  }
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64");
}

function decodeCursor(cursor?: string): Cursor {
  if (!cursor) return { offset: 0 };
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as Cursor;
    return { offset: parsed.offset ?? 0 };
  } catch {
    throw new ValidationError("Invalid cursor");
  }
}

function ensureDir(dir: string) {
  fs.mkdir(dir, { recursive: true }).catch(() => {
    /* ignore */
  });
}
