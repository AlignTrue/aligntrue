import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Artifacts, Storage } from "../src/index.js";

const actor = { actor_id: "tester", actor_type: "human" } as const;

describe("artifacts", () => {
  let dir: string;
  let queryPath: string;
  let derivedPath: string;
  let store: Storage.JsonlArtifactStore;
  const now = "2024-01-02T00:00:00Z";

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "ops-artifacts-"));
    queryPath = join(dir, "query.jsonl");
    derivedPath = join(dir, "derived.jsonl");
    store = new Storage.JsonlArtifactStore(queryPath, derivedPath);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("builds query artifacts deterministically", () => {
    const input = {
      referenced_entities: ["work_item"],
      referenced_fields: ["status", "id"],
      filters: { status: "ready" },
      projection_version: "ready_queue@1.0.0",
      snapshot_id: "snapshot-1",
      created_at: now,
      created_by: actor,
      correlation_id: "corr-1",
    };

    const first = Artifacts.buildQueryArtifact(input);
    const second = Artifacts.buildQueryArtifact(input);

    expect(first.artifact_id).toBe(second.artifact_id);
    expect(first.content_hash).toBe(second.content_hash);
    expect(first.referenced_fields).toEqual(["id", "status"]);
  });

  it("stores derived artifacts only when query references exist", async () => {
    const query = Artifacts.buildQueryArtifact({
      referenced_entities: ["work_item"],
      referenced_fields: ["id"],
      created_at: now,
      created_by: actor,
      correlation_id: "corr-2",
    });
    await store.putQueryArtifact(query);

    const derived = Artifacts.buildDerivedArtifact({
      input_query_ids: [query.artifact_id],
      input_hashes: [query.content_hash],
      policy_version: "stub@0.0.0",
      output_type: "dr_recommendations",
      output_data: { proposals: ["DR-010", "DR-011"] },
      created_at: now,
      created_by: actor,
      correlation_id: "corr-3",
    });

    await store.putDerivedArtifact(derived);

    const stored = await store.getDerivedById(derived.artifact_id);
    expect(stored?.input_query_ids).toEqual([query.artifact_id]);
  });

  it("rejects derived artifacts that reference missing queries", async () => {
    const derived = Artifacts.buildDerivedArtifact({
      input_query_ids: ["missing-query"],
      input_hashes: ["missing-hash"],
      policy_version: "stub@0.0.0",
      output_type: "dr_recommendations",
      output_data: [],
      created_at: now,
      created_by: actor,
      correlation_id: "corr-4",
    });

    await expect(store.putDerivedArtifact(derived)).rejects.toThrow();
  });
});
