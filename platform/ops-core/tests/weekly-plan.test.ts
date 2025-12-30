import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Storage, Projections, Tasks } from "../src/index.js";
const {
  createJsonlTaskLedger,
  TasksProjectionDef,
  buildTasksProjectionFromState,
  hashTasksProjection,
  TASK_COMMAND_TYPES,
} = Tasks;

const ACTOR = { actor_id: "tester", actor_type: "human" } as const;

describe("weekly plan", () => {
  let dir: string;
  let tasksEventsPath: string;
  let queryPath: string;
  let derivedPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "ops-weekly-plan-"));
    tasksEventsPath = join(dir, "tasks-events.jsonl");
    queryPath = join(dir, "query.jsonl");
    derivedPath = join(dir, "derived.jsonl");
    process.env["OPS_PLANS_WEEKLY_ENABLED"] = "1";
    process.env["OPS_TASKS_ENABLED"] = "1";
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    vi.resetModules();
  });

  it("throws when weekly plans are disabled", async () => {
    process.env["OPS_PLANS_WEEKLY_ENABLED"] = "0";
    const { buildWeeklyPlan } =
      (await import("../src/suggestions/weekly-plan.js")) as typeof import("../src/suggestions/weekly-plan.js");
    const artifactStore = new Storage.JsonlArtifactStore(
      queryPath,
      derivedPath,
    );
    const { projection, hash } = await seedTasks(tasksEventsPath);
    await expect(
      buildWeeklyPlan({
        actor: ACTOR,
        artifactStore,
        tasksProjection: projection,
        tasksProjectionHash: hash,
        correlation_id: "corr-disabled",
      }),
    ).rejects.toThrow();
  });

  it("generates deterministically and returns unchanged on second call", async () => {
    const { buildWeeklyPlan } =
      (await import("../src/suggestions/weekly-plan.js")) as typeof import("../src/suggestions/weekly-plan.js");
    const artifactStore = new Storage.JsonlArtifactStore(
      queryPath,
      derivedPath,
    );
    const { projection, hash } = await seedTasks(tasksEventsPath);

    const first = await buildWeeklyPlan({
      actor: ACTOR,
      artifactStore,
      tasksProjection: projection,
      tasksProjectionHash: hash,
      correlation_id: "corr-1",
      now: () => "2024-01-01T00:00:00Z",
    });

    const second = await buildWeeklyPlan({
      actor: ACTOR,
      artifactStore,
      tasksProjection: projection,
      tasksProjectionHash: hash,
      correlation_id: "corr-2",
      now: () => "2024-01-01T00:05:00Z",
    });

    expect(first.outcome).toBe("generated");
    expect(second.outcome).toBe("unchanged");
    expect(first.artifact?.artifact_id).toBe(second.artifact?.artifact_id);
  });

  it("rejects when weekly budget exceeded", async () => {
    process.env["OPS_WEEKLY_PLAN_MAX_PER_WEEK"] = "1";
    process.env["OPS_WEEKLY_PLAN_MIN_HOURS"] = "1";
    const { buildWeeklyPlan } =
      (await import("../src/suggestions/weekly-plan.js")) as typeof import("../src/suggestions/weekly-plan.js");
    const artifactStore = new Storage.JsonlArtifactStore(
      queryPath,
      derivedPath,
    );
    const { projection, hash } = await seedTasks(tasksEventsPath);

    const first = await buildWeeklyPlan({
      actor: ACTOR,
      artifactStore,
      tasksProjection: projection,
      tasksProjectionHash: hash,
      correlation_id: "corr-3",
      now: () => "2024-01-01T00:00:00Z",
    });
    expect(first.outcome).toBe("generated");

    const second = await buildWeeklyPlan({
      actor: ACTOR,
      artifactStore,
      tasksProjection: projection,
      tasksProjectionHash: hash,
      correlation_id: "corr-4",
      force: true,
      now: () => "2024-01-02T02:00:00Z",
    });
    expect(second.outcome).toBe("rejected");
    expect(second.reason).toBe("budget_exceeded");
  });
});

async function seedTasks(eventsPath: string) {
  const ledger = createJsonlTaskLedger({
    eventsPath,
    commandsPath: join(eventsPath, "..", "cmds.jsonl"),
    outcomesPath: join(eventsPath, "..", "outcomes.jsonl"),
    allowExternalPaths: true,
    now: () => "2024-01-01T00:00:00Z",
  });

  await ledger.execute({
    command_id: "cmd-task-1",
    command_type: TASK_COMMAND_TYPES.Create,
    payload: {
      task_id: "task-1",
      title: "Week task",
      bucket: "week",
      status: "open",
      due_at: "2024-01-05T00:00:00Z",
    },
    target_ref: "task:task-1",
    dedupe_scope: "task:task-1",
    correlation_id: "corr-task",
    actor: ACTOR,
    requested_at: "2024-01-01T00:00:00Z",
  });

  const store = new Storage.JsonlEventStore(eventsPath);
  const rebuilt = await Projections.rebuildOne(TasksProjectionDef, store);
  const projection = buildTasksProjectionFromState(rebuilt.data);
  return {
    projection,
    hash: hashTasksProjection(projection),
  };
}
