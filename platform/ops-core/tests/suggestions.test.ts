import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { Feedback, Projections, Storage, Tasks } from "../src/index.js";

const ACTOR = { actor_id: "tester", actor_type: "human" } as const;
const NOW = "2024-01-10T00:00:00Z";

describe("suggestions", () => {
  let dir: string;
  let tasksEventsPath: string;
  let suggestionEventsPath: string;
  let feedbackEventsPath: string;
  let queryPath: string;
  let derivedPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "ops-suggestions-"));
    tasksEventsPath = join(dir, "tasks-events.jsonl");
    suggestionEventsPath = join(dir, "suggestions-events.jsonl");
    feedbackEventsPath = join(dir, "feedback-events.jsonl");
    queryPath = join(dir, "query.jsonl");
    derivedPath = join(dir, "derived.jsonl");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("generates deterministic task triage suggestions", async () => {
    const Suggestions = await loadSuggestionsEnabled();
    const { projection, hash } = await seedTasksLaterDueSoon(tasksEventsPath);
    const artifactStore = new Storage.JsonlArtifactStore(
      queryPath,
      derivedPath,
    );

    const first = await Suggestions.generateTaskTriageSuggestions({
      artifactStore,
      tasks: projection,
      tasks_hash: hash,
      actor: ACTOR,
      now: NOW,
      correlation_id: "corr-1",
      policy_version: "policy@1.0.0",
    });
    const second = await Suggestions.generateTaskTriageSuggestions({
      artifactStore,
      tasks: projection,
      tasks_hash: hash,
      actor: ACTOR,
      now: NOW,
      correlation_id: "corr-1",
      policy_version: "policy@1.0.0",
    });

    expect(first.artifacts).toHaveLength(1);
    expect(second.artifacts).toHaveLength(1);
    expect(first.artifacts[0].artifact_id).toBe(
      second.artifacts[0].artifact_id,
    );
  });

  it("approves suggestion with idempotency and rejects stale hash", async () => {
    const Suggestions = await loadSuggestionsEnabled();
    const { projection, hash } = await seedTasksLaterDueSoon(tasksEventsPath);
    const artifactStore = new Storage.JsonlArtifactStore(
      queryPath,
      derivedPath,
    );
    const feedbackStore = new Storage.JsonlEventStore(feedbackEventsPath);
    const suggestionEvents = new Storage.JsonlEventStore(suggestionEventsPath);

    const generated = await Suggestions.generateTaskTriageSuggestions({
      artifactStore,
      tasks: projection,
      tasks_hash: hash,
      actor: ACTOR,
      now: NOW,
      correlation_id: "corr-approve",
    });
    for (const ev of generated.events) {
      await suggestionEvents.append(ev);
    }

    const executor = new Suggestions.SuggestionExecutor({
      artifactStore,
      feedbackEventStore: feedbackStore,
    });
    const artifact = generated.artifacts[0];

    const command = Suggestions.buildSuggestionCommand(
      "suggestion.approve",
      {
        suggestion_id: artifact.artifact_id,
        expected_hash: artifact.content_hash,
      },
      ACTOR,
    );
    const first = await executor.approve(command);
    expect(first.status).toBe("accepted");

    const again = await executor.approve(command);
    expect(again.status).toBe("accepted"); // idempotent by command id

    const staleCommand = Suggestions.buildSuggestionCommand(
      "suggestion.approve",
      { suggestion_id: artifact.artifact_id, expected_hash: "wrong-hash" },
      ACTOR,
    );
    await expect(executor.approve(staleCommand)).rejects.toThrow();

    const alreadyProcessed = await executor.approve(
      Suggestions.buildSuggestionCommand(
        "suggestion.approve",
        {
          suggestion_id: artifact.artifact_id,
          expected_hash: artifact.content_hash,
        },
        ACTOR,
      ),
    );
    expect(alreadyProcessed.status).toBe("already_processed");
  });

  it("rebuilds inbox projection from suggestion + feedback events", async () => {
    const Suggestions = await loadSuggestionsEnabled();
    const suggestionEvents = new Storage.JsonlEventStore(suggestionEventsPath);
    const feedbackStore = new Storage.JsonlEventStore(feedbackEventsPath);
    const id = "suggestion-1";
    const generated = Suggestions.buildSuggestionGeneratedEvent({
      suggestion_id: id,
      suggestion_type: "task_triage",
      target_refs: ["task:a"],
      correlation_id: "corr-inbox",
      actor: ACTOR,
      occurred_at: NOW,
    });
    await suggestionEvents.append(generated);

    const feedbackEvent = Feedback.buildFeedbackEvent({
      artifact_id: id,
      feedback_type: Feedback.FEEDBACK_TYPES.Accepted,
      correlation_id: "corr-inbox",
      actor: ACTOR,
      occurred_at: NOW,
    });
    await feedbackStore.append(feedbackEvent);

    const rebuilt = await Suggestions.rebuildInboxProjection({
      suggestionEventsPath,
      feedbackEventsPath,
    });

    expect(rebuilt.projection.suggestions).toHaveLength(1);
    expect(rebuilt.projection.suggestions[0].status).toBe("approved");
  });

  it("builds daily plan artifact", async () => {
    const Suggestions = await loadSuggestionsEnabled();
    const artifactStore = new Storage.JsonlArtifactStore(
      queryPath,
      derivedPath,
    );
    const plan = await Suggestions.buildAndStoreDailyPlan({
      task_ids: ["task-1", "task-2"],
      date: "2024-01-10",
      tasks_projection_hash: "hash-tasks",
      actor: ACTOR,
      artifactStore,
      correlation_id: "corr-plan",
      auto_generated: false,
      created_at: NOW,
    });

    const stored = await artifactStore.getDerivedById(plan.artifact_id);
    expect(stored?.output_type).toBe("daily_plan");
    expect((stored?.output_data as Suggestions.DailyPlanData).task_ids).toEqual(
      ["task-1", "task-2"],
    );
  });

  it("returns no suggestions when flag disabled", async () => {
    process.env["OPS_SUGGESTIONS_ENABLED"] = "0";
    await vi.resetModules();
    const Suggestions =
      (await import("../src/suggestions/index.js")) as typeof import("../src/suggestions/index.js");
    const { projection, hash } = await seedTasksLaterDueSoon(tasksEventsPath);
    const artifactStore = new Storage.JsonlArtifactStore(
      queryPath,
      derivedPath,
    );
    const result = await Suggestions.generateTaskTriageSuggestions({
      artifactStore,
      tasks: projection,
      tasks_hash: hash,
      actor: ACTOR,
      now: NOW,
    });
    expect(result.artifacts).toHaveLength(0);
    expect(result.events).toHaveLength(0);
  });
});

async function seedTasksLaterDueSoon(eventsPath: string) {
  const ledger = Tasks.createJsonlTaskLedger({
    eventsPath,
    commandsPath: join(eventsPath, "..", "cmds.jsonl"),
    outcomesPath: join(eventsPath, "..", "outcomes.jsonl"),
    now: () => NOW,
  });

  await ledger.execute({
    command_id: "cmd-1",
    command_type: "task.create",
    payload: {
      task_id: "task-1",
      title: "Later task",
      bucket: "later",
      status: "open",
      due_at: "2024-01-12T00:00:00Z",
    },
    target_ref: "task:task-1",
    dedupe_scope: "task:task-1",
    correlation_id: "corr-create",
    actor: ACTOR,
    requested_at: NOW,
  });

  const store = new Storage.JsonlEventStore(eventsPath);
  const rebuilt = await Projections.rebuildOne(
    Projections.TasksProjectionDef,
    store,
  );
  const projection = Projections.buildTasksProjectionFromState(
    rebuilt.data as Projections.TasksProjectionState,
  );
  const hash = Projections.hashTasksProjection(projection);
  return { projection, hash };
}

async function loadSuggestionsEnabled() {
  process.env["OPS_SUGGESTIONS_ENABLED"] = "1";
  process.env["OPS_TASKS_ENABLED"] = "1";
  process.env["OPS_NOTES_ENABLED"] = "1";
  await vi.resetModules();
  return (await import("../src/suggestions/index.js")) as typeof import("../src/suggestions/index.js");
}
