import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, resolve, sep } from "node:path";
import { OPS_DATA_DIR } from "../config.js";
import type { CommandEnvelope, CommandOutcome } from "../envelopes/index.js";
import type { CommandLog } from "./interfaces.js";

const DEFAULT_COMMANDS_PATH = join(OPS_DATA_DIR, "ops-core-commands.jsonl");
const DEFAULT_OUTCOMES_PATH = join(
  OPS_DATA_DIR,
  "ops-core-command-outcomes.jsonl",
);
const OPS_DATA_DIR_ABS = resolve(OPS_DATA_DIR);
const OPS_DATA_DIR_ROOT = parse(OPS_DATA_DIR_ABS).root;
const OPS_DATA_DIR_IS_ROOT = OPS_DATA_DIR_ABS === OPS_DATA_DIR_ROOT;

export class JsonlCommandLog implements CommandLog {
  private readonly commandsPath: string;
  private readonly outcomesPath: string;

  constructor(
    commandsPath: string = DEFAULT_COMMANDS_PATH,
    outcomesPath: string = DEFAULT_OUTCOMES_PATH,
  ) {
    this.commandsPath = resolveDataPath(commandsPath);
    this.outcomesPath = resolveDataPath(outcomesPath);
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
}

function resolveDataPath(candidate: string): string {
  const absolute = isAbsolute(candidate)
    ? resolve(candidate)
    : resolve(OPS_DATA_DIR_ABS, candidate);

  // Caller supplied an explicit absolute path (e.g., tmpdir in tests). Respect
  // it after normalization, since this is an intentional override.
  if (isAbsolute(candidate)) {
    return absolute;
  }

  // If OPS_DATA_DIR points to the filesystem root ("/" or "C:\"),
  // everything resides under that root by definition.
  if (OPS_DATA_DIR_IS_ROOT) {
    return absolute;
  }

  if (
    absolute === OPS_DATA_DIR_ABS ||
    absolute.startsWith(`${OPS_DATA_DIR_ABS}${sep}`)
  ) {
    return absolute;
  }

  throw new Error(
    `JsonlCommandLog refuses to write outside OPS_DATA_DIR (got ${candidate})`,
  );
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
  await mkdir(dirname(resolve(path)), { recursive: true });
  try {
    await writeFile(resolve(path), "", { flag: "a" });
  } catch {
    // ignore
  }
}
