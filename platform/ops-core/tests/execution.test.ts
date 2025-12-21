import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import {
  Execution,
  Identity,
  Storage,
  Projections,
  OPS_MODEL_MAX_CALLS_PER_RUN,
} from "../src/index.js";
import { routeStep } from "../src/execution/router.js";
import { BudgetTracker } from "../src/execution/budget.js";

const actor = { actor_id: "tester", actor_type: "human" } as const;

describe("Execution runtime", () => {
  let dir: string;
  let eventsPath: string;
  let commandsPath: string;
  let outcomesPath: string;
  const now = () => "2024-02-01T00:00:00Z";

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "ops-exec-"));
    eventsPath = join(dir, "exec-events.jsonl");
    commandsPath = join(dir, "exec-commands.jsonl");
    outcomesPath = join(dir, "exec-outcomes.jsonl");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("router decisions are deterministic with receipts", () => {
    const input = {
      run_id: "run-1",
      step_id: "step-1",
      kind: "validate",
    };
    const first = routeStep(input, {
      actor,
      correlation_id: "corr-1",
      now: () => now(),
    });
    const second = routeStep(input, {
      actor,
      correlation_id: "corr-1",
      now: () => now(),
    });
    expect(first.decision.route).toBe("DETERMINISTIC_REQUIRED");
    expect(first.receipt.receipt_id).toBe(second.receipt.receipt_id);
    expect(first.receipt.content_hash).toBe(second.receipt.content_hash);
  });

  it("rejects step success without proof refs", async () => {
    const runtime = new Execution.ExecutionRuntime(
      new Storage.JsonlEventStore(eventsPath),
      new Storage.JsonlCommandLog(commandsPath, outcomesPath),
      { now },
    );

    const runId = "run-proof";
    await runtime.execute(
      buildCommand("run.start", { run_id: runId, target_ref: "validate" }),
    );

    const outcome = await runtime.execute(
      buildCommand("step.succeed", {
        run_id: runId,
        step_id: "step-proof",
        proof_refs: [],
      }),
    );
    expect(outcome.status).toBe("rejected");
    expect(outcome.reason).toBe("proof_refs_required");
  });

  it("enforces budget per run", () => {
    const tracker = new BudgetTracker();
    let lastAllowed = true;
    for (let i = 0; i < OPS_MODEL_MAX_CALLS_PER_RUN + 1; i++) {
      const check = tracker.checkAndRecord(
        { run_id: "run-budget" },
        {
          actor,
          correlation_id: "corr-budget",
          now: () => Date.now(),
        },
      );
      lastAllowed = check.allowed;
    }
    expect(lastAllowed).toBe(false);
  });

  it("rebuilds run projections deterministically", async () => {
    const runtime = new Execution.ExecutionRuntime(
      new Storage.JsonlEventStore(eventsPath),
      new Storage.JsonlCommandLog(commandsPath, outcomesPath),
      { now },
    );

    const runId = "run-rebuild";
    const stepId = "step-1";
    await runtime.execute(buildCommand("run.start", { run_id: runId }));
    await runtime.execute(
      buildCommand("step.attempt", {
        run_id: runId,
        step_id: stepId,
        kind: "validate",
      }),
    );
    await runtime.execute(
      buildCommand("step.succeed", {
        run_id: runId,
        step_id: stepId,
        proof_refs: ["artifact-1"],
      }),
    );

    const projectionA = await Projections.rebuildRuns(
      new Storage.JsonlEventStore(eventsPath),
    );
    const projectionB = await Projections.rebuildRuns(
      new Storage.JsonlEventStore(eventsPath),
    );

    expect(projectionA.hash).toBe(projectionB.hash);
    expect(projectionA.runs.runs[0].steps[0].status).toBe("succeeded");
  });
});

function buildCommand<T extends Execution.ExecutionCommandType>(
  command_type: T,
  payload: Execution.ExecutionCommandPayload,
): Execution.ExecutionCommandEnvelope<T> {
  return {
    command_id: Identity.generateCommandId({ command_type, payload }),
    command_type,
    payload,
    target_ref: "execution",
    dedupe_scope: "execution",
    correlation_id: Identity.randomId(),
    actor,
    requested_at: new Date().toISOString(),
  } as Execution.ExecutionCommandEnvelope<T>;
}
