import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { CommandEnvelope, CommandOutcome } from "../envelopes/index.js";
import type { CommandLog } from "./interfaces.js";

const DEFAULT_COMMANDS_PATH = "./data/ops-core-commands.jsonl";
const DEFAULT_OUTCOMES_PATH = "./data/ops-core-command-outcomes.jsonl";

export class JsonlCommandLog implements CommandLog {
  constructor(
    private readonly commandsPath: string = DEFAULT_COMMANDS_PATH,
    private readonly outcomesPath: string = DEFAULT_OUTCOMES_PATH,
  ) {}

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
        const parsed = JSON.parse(lines[i]) as CommandOutcome;
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
