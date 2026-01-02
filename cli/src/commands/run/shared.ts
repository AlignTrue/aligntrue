import {
  OPS_CORE_ENABLED,
  OPS_HYBRID_EXEC_ENABLED,
  Execution,
  Identity,
  Storage,
  Projections,
} from "@aligntrue/core";
import { exitWithError } from "../../utils/command-utilities.js";
import { CLI_ACTOR } from "../../utils/cli-actor.js";

export function ensureHybridEnabled(): void {
  if (!OPS_CORE_ENABLED) {
    exitWithError(1, "ops-core is disabled", {
      hint: "Set OPS_CORE_ENABLED=1 to enable run commands",
    });
  }
  if (!OPS_HYBRID_EXEC_ENABLED) {
    exitWithError(1, "hybrid execution is disabled", {
      hint: "Set OPS_HYBRID_EXEC_ENABLED=1 to enable run commands",
    });
  }
}

export function createRuntime(): Execution.ExecutionRuntime {
  return Execution.createJsonlExecutionRuntime();
}

type EnvelopeFor<T extends Execution.ExecutionCommandType> = Extract<
  Execution.ExecutionCommandEnvelope,
  { command_type: T }
>;

export function buildCommandEnvelope<T extends Execution.ExecutionCommandType>(
  command_type: T,
  payload: EnvelopeFor<T>["payload"],
): EnvelopeFor<T> {
  const idempotency_key = Identity.generateCommandId({ command_type, payload });
  return {
    command_id: Identity.randomId(),
    idempotency_key,
    command_type,
    payload,
    target_ref: "execution",
    dedupe_scope: "target",
    correlation_id: Identity.randomId(),
    actor: CLI_ACTOR,
    requested_at: new Date().toISOString(),
  } as EnvelopeFor<T>;
}

export async function readRunsProjection() {
  return Projections.rebuildRuns(
    new Storage.JsonlEventStore(Execution.DEFAULT_EXECUTION_EVENTS_PATH),
  );
}
