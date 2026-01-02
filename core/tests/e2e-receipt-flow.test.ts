import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  Artifacts,
  Feedback,
  Identity,
  Projections,
  Storage,
  WorkLedger,
} from "../src/index.js";

const actor = { actor_id: "tester", actor_type: "human" } as const;

describe("end-to-end receipt chain", () => {
  let dir: string;
  let eventsPath: string;
  let queryPath: string;
  let derivedPath: string;
  let feedbackPath: string;
  const now = "2024-01-04T00:00:00Z";

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "ops-receipts-"));
    eventsPath = join(dir, "events.jsonl");
    queryPath = join(dir, "query.jsonl");
    derivedPath = join(dir, "derived.jsonl");
    feedbackPath = join(dir, "feedback.jsonl");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("links query -> derived -> feedback with deterministic ids", async () => {
    // 1) Create work ledger events and rebuild projections
    const ledgerStore = new Storage.JsonlEventStore(eventsPath);
    const events: WorkLedger.WorkLedgerEvent[] = [
      {
        event_id: Identity.generateEventId({
          work_id: "a",
          correlation_id: "corr-1",
        }),
        event_type: WorkLedger.WORK_EVENT_TYPES.WorkItemCreated,
        payload: { work_id: "a", title: "Task A" },
        occurred_at: now,
        ingested_at: now,
        correlation_id: "corr-1",
        actor,
        capability_scope: [],
        schema_version: WorkLedger.WORK_LEDGER_SCHEMA_VERSION,
      },
      {
        event_id: Identity.generateEventId({
          work_id: "b",
          correlation_id: "corr-2",
        }),
        event_type: WorkLedger.WORK_EVENT_TYPES.WorkItemCreated,
        payload: { work_id: "b", title: "Task B" },
        occurred_at: now,
        ingested_at: now,
        correlation_id: "corr-2",
        actor,
        capability_scope: [],
        schema_version: WorkLedger.WORK_LEDGER_SCHEMA_VERSION,
      },
      {
        event_id: Identity.generateEventId({
          work_id: "b",
          depends_on: "a",
          correlation_id: "corr-3",
        }),
        event_type: WorkLedger.WORK_EVENT_TYPES.DependencyAdded,
        payload: { work_id: "b", depends_on: "a" },
        occurred_at: now,
        ingested_at: now,
        correlation_id: "corr-3",
        actor,
        capability_scope: [],
        schema_version: WorkLedger.WORK_LEDGER_SCHEMA_VERSION,
      },
      {
        event_id: Identity.generateEventId({
          work_id: "a",
          correlation_id: "corr-4",
        }),
        event_type: WorkLedger.WORK_EVENT_TYPES.WorkItemCompleted,
        payload: { work_id: "a" },
        occurred_at: now,
        ingested_at: now,
        correlation_id: "corr-4",
        actor,
        capability_scope: [],
        schema_version: WorkLedger.WORK_LEDGER_SCHEMA_VERSION,
      },
    ];

    for (const event of events) {
      await ledgerStore.append(event);
    }

    const ledgerProjections = await Projections.rebuildWorkLedger(ledgerStore);
    expect(ledgerProjections.readyQueue.ready).toEqual(["b"]);

    // 2) Build and store query artifact
    const artifactStore = new Storage.JsonlArtifactStore(
      queryPath,
      derivedPath,
    );
    const query = Artifacts.buildQueryArtifact({
      referenced_entities: ["work_item"],
      referenced_fields: ["id", "status"],
      filters: { readiness: "ready" },
      projection_version: "ready_queue@1.0.0",
      snapshot_id:
        ledgerProjections.freshness.readyQueue.last_event_id ?? undefined,
      created_at: now,
      created_by: actor,
      correlation_id: "corr-query",
    });
    await artifactStore.putQueryArtifact(query);

    // 3) Build and store derived artifact referencing the query
    const derived = Artifacts.buildDerivedArtifact({
      input_query_ids: [query.artifact_id],
      input_hashes: [query.content_hash, ledgerProjections.hash],
      policy_version: "stub@0.0.0",
      output_type: "dr_recommendations",
      output_data: {
        recommendations: [
          {
            id: "DR-010",
            target_work_id: "b",
            reason: "ready with no blockers",
          },
          {
            id: "DR-011",
            target_work_id: "b",
            reason: "prioritize DR decisions",
          },
        ],
      },
      created_at: now,
      created_by: actor,
      correlation_id: "corr-derived",
    });
    await artifactStore.putDerivedArtifact(derived);

    // 4) Record feedback on the derived artifact
    const feedbackEventStore = new Storage.JsonlEventStore(feedbackPath);
    const feedbackEvent = Feedback.buildFeedbackEvent({
      artifact_id: derived.artifact_id,
      feedback_type: Feedback.FEEDBACK_TYPES.Rejected,
      comment: "Need evidence for DR sequencing",
      correlation_id: "corr-feedback",
      actor,
      occurred_at: now,
    });
    await feedbackEventStore.append(feedbackEvent);

    // 5) Verify linkage chain
    const storedQuery = await artifactStore.getQueryById(query.artifact_id);
    const storedDerived = await artifactStore.getDerivedById(
      derived.artifact_id,
    );
    const feedbacks = await Feedback.feedbackByArtifactId(
      feedbackEventStore.stream(),
      derived.artifact_id,
    );

    expect(storedQuery?.artifact_id).toBe(query.artifact_id);
    expect(storedDerived?.input_query_ids).toEqual([query.artifact_id]);
    expect(feedbacks).toHaveLength(1);
    expect(feedbacks[0].payload.comment).toContain("evidence");
  });
});
