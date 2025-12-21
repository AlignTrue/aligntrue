import type { EventEnvelope } from "../envelopes/index.js";
import type { EventStore } from "../storage/interfaces.js";
import type { ProjectionDefinition } from "./definition.js";
import {
  EXECUTION_EVENT_TYPES,
  type ExecutionEvent,
} from "../execution/events.js";
import {
  initialState as executionInitialState,
  reduceEvent as reduceExecutionEvent,
  type ExecutionState,
} from "../execution/state-machine.js";
import type { RunState, StepState } from "../execution/types.js";

export interface RunsProjectionState {
  execution: ExecutionState;
  last_event_id: string | null;
  last_ingested_at: string | null;
}

export interface StepSummary {
  step_id: string;
  kind: string;
  status: StepState["status"];
  route?: StepState["route"] | undefined;
  proof_refs: string[];
  router_decision_ref?: string | undefined;
  started_at: string;
  completed_at?: string | undefined;
  reason?: string | undefined;
}

export interface RunSummary {
  run_id: string;
  status: RunState["status"];
  started_at: string;
  completed_at?: string | undefined;
  steps: StepSummary[];
}

export const RunsProjectionDef: ProjectionDefinition<RunsProjectionState> = {
  name: "runs",
  version: "1.0.0",
  init: () => ({
    execution: executionInitialState(),
    last_event_id: null,
    last_ingested_at: null,
  }),
  apply: (state, event) => applyExecutionEvent(state, event),
  getFreshness: (state) => ({
    last_event_id: state.last_event_id,
    last_ingested_at: state.last_ingested_at,
  }),
};

function applyExecutionEvent(
  state: RunsProjectionState,
  event: EventEnvelope,
): RunsProjectionState {
  if (!isExecutionEvent(event)) return state;
  reduceExecutionEvent(state.execution, event as ExecutionEvent);
  state.last_event_id = event.event_id;
  state.last_ingested_at = event.ingested_at;
  return state;
}

function isExecutionEvent(event: EventEnvelope): boolean {
  return Object.values(EXECUTION_EVENT_TYPES).includes(
    event.event_type as (typeof EXECUTION_EVENT_TYPES)[keyof typeof EXECUTION_EVENT_TYPES],
  );
}

export function buildRunsProjectionFromState(state: RunsProjectionState): {
  runs: RunSummary[];
} {
  const runs: RunSummary[] = [];
  for (const run of state.execution.runs.values()) {
    runs.push({
      run_id: run.run_id,
      status: run.status,
      started_at: run.started_at,
      completed_at: run.completed_at,
      steps: Array.from(run.steps.values()).map(toStepSummary),
    });
  }
  return { runs };
}

export async function rebuildRuns(store: EventStore): Promise<{
  runs: { runs: RunSummary[] };
}> {
  let state = RunsProjectionDef.init();
  for await (const event of store.stream()) {
    state = RunsProjectionDef.apply(state, event);
  }
  return { runs: buildRunsProjectionFromState(state) };
}

function toStepSummary(step: StepState): StepSummary {
  return {
    step_id: step.step_id,
    kind: step.kind,
    status: step.status,
    route: step.route,
    proof_refs: [...step.proof_refs],
    router_decision_ref: step.router_decision_ref,
    started_at: step.started_at,
    completed_at: step.completed_at,
    reason: step.reason,
  };
}
