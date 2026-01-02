import { createWriteStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, relative, resolve } from "node:path";
import { ensureDirectoryExists } from "@aligntrue/file-utils";
import { OPS_DATA_DIR } from "../config.js";
import { ValidationError } from "../errors.js";
import type { CommandEnvelope, CommandOutcome } from "../envelopes/index.js";
import type {
  CommandLog,
  CommandLogTryStartInput,
  CommandLogTryStartResult,
} from "./interfaces.js";

export const DEFAULT_COMMANDS_PATH = join(
  OPS_DATA_DIR,
  "ops-core-commands.jsonl",
);
export const DEFAULT_OUTCOMES_PATH = join(
  OPS_DATA_DIR,
  "ops-core-command-outcomes.jsonl",
);
const OPS_DATA_DIR_ABS = resolve(OPS_DATA_DIR);
const OPS_DATA_DIR_ROOT = parse(OPS_DATA_DIR_ABS).root;
const OPS_DATA_DIR_IS_ROOT = OPS_DATA_DIR_ABS === OPS_DATA_DIR_ROOT;

type JsonlCommandLogOptions = {
  /** Allow absolute paths outside OPS_DATA_DIR (use only in trusted contexts like tests). */
  allowExternalPaths?: boolean | undefined;
};

export class JsonlCommandLog implements CommandLog {
  private readonly commandsPath: string;
  private readonly outcomesPath: string;
  private readonly pendingMeta = new Map<
    string,
    {
      idempotency_key: string;
      dedupe_scope: string;
      scope_key: string;
      started_at: string;
    }
  >();

  constructor(
    commandsPath: string = DEFAULT_COMMANDS_PATH,
    outcomesPath: string = DEFAULT_OUTCOMES_PATH,
    options?: JsonlCommandLogOptions,
  ) {
    const allowExternalPaths = options?.allowExternalPaths ?? false;
    this.commandsPath = resolveDataPath(commandsPath, allowExternalPaths);
    this.outcomesPath = resolveDataPath(outcomesPath, allowExternalPaths);
  }

  async record(command: CommandEnvelope): Promise<void> {
    await ensureFile(this.commandsPath);
    await appendLine(this.commandsPath, command);
  }

  async recordOutcome(outcome: CommandOutcome): Promise<void> {
    await ensureFile(this.outcomesPath);
    await appendLine(this.outcomesPath, outcome);
  }

  async getByIdempotencyKey(commandId: string): Promise<CommandOutcome | null> {
    try {
      const data = await readFile(this.outcomesPath, "utf8");
      const lines = data.split("\n").filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        const line = lines[i];
        if (!line) continue;
        const parsed = JSON.parse(line) as CommandOutcome;
        if (parsed.command_id === commandId) {
          return parsed;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Substrate-level idempotency: start or short-circuit a command.
   */
  async tryStart(
    input: CommandLogTryStartInput,
  ): Promise<CommandLogTryStartResult> {
    const { idempotency_key, scope_key } = input;
    const now = new Date().toISOString();

    const { byScopeKey } = await this.loadCommandIndex();
    const existing = byScopeKey.get(keyForScope(scope_key, idempotency_key));

    if (existing) {
      if (existing.status === "completed" || existing.status === "failed") {
        const outcome =
          (await this.findOutcome(existing.command_id)) ??
          ({
            command_id: existing.command_id,
            status:
              existing.status === "failed" ? "failed" : "already_processed",
            reason:
              existing.status === "failed"
                ? (existing.reason ?? "command failed")
                : "already processed",
          } satisfies CommandOutcome);
        return { status: "duplicate", outcome };
      }
      if (existing.status === "pending") {
        return { status: "in_flight" };
      }
    }

    // No existing record: append pending entry and remember metadata
    const meta = {
      command_id: input.command_id,
      idempotency_key,
      dedupe_scope: input.dedupe_scope,
      scope_key,
      status: "pending" as const,
      started_at: now,
    };
    await ensureFile(this.commandsPath);
    await appendLine(this.commandsPath, meta);
    this.pendingMeta.set(input.command_id, {
      idempotency_key,
      dedupe_scope: input.dedupe_scope,
      scope_key,
      started_at: now,
    });
    return { status: "new" };
  }

  /**
   * Mark command complete (accepted/rejected/failed).
   */
  async complete(commandId: string, outcome: CommandOutcome): Promise<void> {
    const meta =
      this.pendingMeta.get(commandId) ??
      (await this.getLatestMeta(commandId)) ??
      undefined;
    if (!meta) {
      // Best-effort: still record outcome
      await this.recordOutcome(outcome);
      return;
    }

    const completed_at = new Date().toISOString();
    const status =
      outcome.status === "failed" || outcome.status === "rejected"
        ? "failed"
        : "completed";
    const entry = {
      command_id: commandId,
      idempotency_key: meta.idempotency_key,
      dedupe_scope: meta.dedupe_scope,
      scope_key: meta.scope_key,
      status,
      started_at: meta.started_at,
      completed_at,
      reason: outcome.reason,
    };

    await ensureFile(this.commandsPath);
    await appendLine(this.commandsPath, entry);
    await this.recordOutcome({
      ...outcome,
      completed_at: outcome.completed_at ?? completed_at,
    });
  }

  private async loadCommandIndex(): Promise<{
    byCommandId: Map<
      string,
      {
        command_id: string;
        idempotency_key: string;
        dedupe_scope: string;
        scope_key: string;
        status: string;
        reason?: string;
      }
    >;
    byScopeKey: Map<
      string,
      { command_id: string; status: string; reason?: string }
    >;
  }> {
    const byCommandId = new Map<
      string,
      {
        command_id: string;
        idempotency_key: string;
        dedupe_scope: string;
        scope_key: string;
        status: string;
        reason?: string;
      }
    >();
    const byScopeKey = new Map<
      string,
      { command_id: string; status: string; reason?: string }
    >();

    try {
      const data = await readFile(this.commandsPath, "utf8");
      const lines = data.split("\n").filter(Boolean);
      for (const line of lines) {
        const parsed = JSON.parse(line) as {
          command_id: string;
          idempotency_key: string;
          dedupe_scope: string;
          scope_key: string;
          status: string;
          reason?: string;
        };
        const entry = {
          command_id: parsed.command_id,
          idempotency_key: parsed.idempotency_key,
          dedupe_scope: parsed.dedupe_scope,
          scope_key: parsed.scope_key,
          status: parsed.status,
          ...(parsed.reason !== undefined ? { reason: parsed.reason } : {}),
        };
        byCommandId.set(parsed.command_id, entry);
        byScopeKey.set(keyForScope(parsed.scope_key, parsed.idempotency_key), {
          command_id: parsed.command_id,
          status: parsed.status,
          ...(parsed.reason !== undefined ? { reason: parsed.reason } : {}),
        });
      }
    } catch {
      // ignore missing file
    }

    return { byCommandId, byScopeKey };
  }

  private async getLatestMeta(commandId: string): Promise<{
    idempotency_key: string;
    dedupe_scope: string;
    scope_key: string;
    started_at?: string;
  } | null> {
    try {
      const data = await readFile(this.commandsPath, "utf8");
      const lines = data.split("\n").filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        const line = lines[i];
        if (!line) continue;
        const parsed = JSON.parse(line) as {
          command_id: string;
          idempotency_key: string;
          dedupe_scope: string;
          scope_key: string;
          started_at?: string;
        };
        if (parsed.command_id === commandId) {
          return {
            idempotency_key: parsed.idempotency_key,
            dedupe_scope: parsed.dedupe_scope,
            scope_key: parsed.scope_key,
            ...(parsed.started_at !== undefined
              ? { started_at: parsed.started_at }
              : {}),
          };
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private async findOutcome(commandId: string): Promise<CommandOutcome | null> {
    try {
      const data = await readFile(this.outcomesPath, "utf8");
      const lines = data.split("\n").filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        const line = lines[i];
        if (!line) continue;
        const parsed = JSON.parse(line) as CommandOutcome;
        if (parsed.command_id === commandId) {
          return parsed;
        }
      }
      return null;
    } catch {
      return null;
    }
  }
}

function resolveDataPath(
  candidate: string | undefined,
  allowExternalPaths: boolean,
): string {
  if (!candidate) {
    throw new ValidationError("JsonlCommandLog requires a valid path", {
      candidate,
    });
  }

  // If allowExternalPaths is true, we allow any absolute path.
  // This is mostly for tests.
  if (allowExternalPaths && isAbsolute(candidate)) {
    return resolve(candidate);
  }

  // Otherwise, we force everything into OPS_DATA_DIR_ABS.
  // We resolve the candidate relative to OPS_DATA_DIR_ABS and then
  // verify it didn't escape via '..'
  const absolutePath = resolve(OPS_DATA_DIR_ABS, candidate);

  if (isWithinOpsData(absolutePath)) {
    return absolutePath;
  }

  throw new ValidationError(
    "JsonlCommandLog refuses to write outside OPS_DATA_DIR",
    { candidate, resolved_path: absolutePath },
  );
}

function isWithinOpsData(absolutePath: string): boolean {
  if (OPS_DATA_DIR_IS_ROOT) {
    return true;
  }
  const rel = relative(OPS_DATA_DIR_ABS, absolutePath);
  return !rel.startsWith("..") && !isAbsolute(rel);
}

async function appendLine(path: string, value: unknown): Promise<void> {
  const stream = createWriteStream(path, { flags: "a" });
  stream.write(`${JSON.stringify(value)}\n`);
  await new Promise<void>((resolveWrite, reject) => {
    stream.end(() => resolveWrite());
    stream.on("error", reject);
  });
}

async function ensureFile(path: string): Promise<void> {
  ensureDirectoryExists(dirname(resolve(path)));
  try {
    await writeFile(resolve(path), "", { flag: "a" });
  } catch {
    // ignore
  }
}

function keyForScope(scopeKey: string, idempotencyKey: string): string {
  return `${scopeKey}::${idempotencyKey}`;
}
