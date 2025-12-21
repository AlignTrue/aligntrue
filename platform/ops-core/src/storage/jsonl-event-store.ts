import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import readline from "node:readline";
import { OPS_DATA_DIR } from "../config.js";
import type { EventEnvelope } from "../envelopes/index.js";
import type { EventStore } from "./interfaces.js";

export const DEFAULT_EVENTS_PATH = join(OPS_DATA_DIR, "ops-core-events.jsonl");

export class JsonlEventStore implements EventStore {
  constructor(private readonly filePath: string = DEFAULT_EVENTS_PATH) {}

  async append(event: EventEnvelope): Promise<void> {
    await ensureDir(this.filePath);
    const stream = createWriteStream(this.filePath, { flags: "a" });
    stream.write(`${JSON.stringify(event)}\n`);
    await new Promise<void>((resolveWrite, reject) => {
      stream.end(() => resolveWrite());
      stream.on("error", reject);
    });
  }

  async *stream(opts?: {
    after?: string;
    limit?: number;
  }): AsyncIterable<EventEnvelope> {
    const path = resolve(this.filePath);
    let count = 0;
    let startCollecting = !opts?.after;

    try {
      const input = createReadStream(path, { encoding: "utf8" });
      const rl = readline.createInterface({ input, crlfDelay: Infinity });
      for await (const line of rl) {
        if (!line.trim()) continue;
        const parsed = JSON.parse(line) as EventEnvelope;
        if (!startCollecting) {
          if (parsed.event_id === opts?.after) {
            startCollecting = true;
          }
          continue;
        }
        yield parsed;
        count += 1;
        if (opts?.limit && count >= opts.limit) {
          break;
        }
      }
    } catch {
      // If file does not exist yet, treat as empty.
      return;
    }
  }

  async getById(eventId: string): Promise<EventEnvelope | null> {
    try {
      const data = await readFile(this.filePath, "utf8");
      const lines = data.split("\n").filter(Boolean);
      for (const line of lines) {
        const parsed = JSON.parse(line) as EventEnvelope;
        if (parsed.event_id === eventId) {
          return parsed;
        }
      }
      return null;
    } catch {
      return null;
    }
  }
}

async function ensureDir(filePath: string): Promise<void> {
  await mkdir(dirname(resolve(filePath)), { recursive: true });
  // Ensure file exists
  try {
    await writeFile(resolve(filePath), "", { flag: "a" });
  } catch {
    // ignore
  }
}
