import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { DerivedArtifact, QueryArtifact } from "../artifacts/index.js";
import { ValidationError } from "../errors.js";
import type { ArtifactStore } from "./interfaces.js";

const DEFAULT_QUERY_PATH = "./data/ops-core-query-artifacts.jsonl";
const DEFAULT_DERIVED_PATH = "./data/ops-core-derived-artifacts.jsonl";

export class JsonlArtifactStore implements ArtifactStore<
  QueryArtifact,
  DerivedArtifact
> {
  constructor(
    private readonly queryPath: string = DEFAULT_QUERY_PATH,
    private readonly derivedPath: string = DEFAULT_DERIVED_PATH,
  ) {}

  async putQueryArtifact(artifact: QueryArtifact): Promise<void> {
    await ensureFile(this.queryPath);
    const existing = await this.getQueryById(artifact.artifact_id);
    if (existing) return; // idempotent
    await appendLine(this.queryPath, artifact);
  }

  async putDerivedArtifact(artifact: DerivedArtifact): Promise<void> {
    await ensureFile(this.derivedPath);
    const queries = await this.listQueryArtifacts();
    const knownQueryIds = new Set(queries.map((q) => q.artifact_id));
    for (const id of artifact.input_query_ids) {
      if (!knownQueryIds.has(id)) {
        throw new ValidationError(
          `DerivedArtifact references missing query artifact: ${id}`,
        );
      }
    }
    const existing = await this.getDerivedById(artifact.artifact_id);
    if (existing) return; // idempotent
    await appendLine(this.derivedPath, artifact);
  }

  async getQueryById(id: string): Promise<QueryArtifact | null> {
    return this.readById<QueryArtifact>(this.queryPath, "artifact_id", id);
  }

  async getDerivedById(id: string): Promise<DerivedArtifact | null> {
    return this.readById<DerivedArtifact>(this.derivedPath, "artifact_id", id);
  }

  async listQueryArtifacts(): Promise<QueryArtifact[]> {
    return this.readAll<QueryArtifact>(this.queryPath);
  }

  async listDerivedArtifacts(): Promise<DerivedArtifact[]> {
    return this.readAll<DerivedArtifact>(this.derivedPath);
  }

  private async readById<T extends Record<string, unknown>>(
    path: string,
    idField: string,
    id: string,
  ): Promise<T | null> {
    try {
      const data = await readFile(path, "utf8");
      const lines = data.split("\n").filter(Boolean);
      for (const line of lines) {
        const parsed = JSON.parse(line) as T;
        if (parsed[idField] === id) {
          return parsed;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private async readAll<T>(path: string): Promise<T[]> {
    try {
      const data = await readFile(path, "utf8");
      const lines = data.split("\n").filter(Boolean);
      return lines.map((line) => JSON.parse(line) as T);
    } catch {
      return [];
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
