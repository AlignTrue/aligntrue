import { hashCanonical } from "../identity/hash.js";
import { ValidationError } from "../errors.js";
import type { EventStore } from "../storage/interfaces.js";
import type {
  ProjectionDefinition,
  ProjectionFreshness,
} from "./definition.js";
import {
  projectionKey,
  ProjectionRegistry,
  defaultRegistry,
} from "./registry.js";
import {
  WorkItemsProjectionDef,
  buildWorkItemsProjectionFromState,
  type WorkItemsProjectionState,
} from "./work-items.js";
import { ActivePolicyProjectionDef } from "./policy.js";
import {
  ReadyQueueProjectionDef,
  buildReadyQueueProjectionFromState,
  type ReadyQueueProjectionState,
} from "./ready-queue.js";
import {
  RunsProjectionDef,
  buildRunsProjectionFromState,
  type RunsProjectionState,
} from "./runs.js";

export interface ProjectionOutput<T> {
  name: string;
  version: string;
  data: T;
  freshness: ProjectionFreshness;
  hash: string;
}

export async function rebuildOne<TState>(
  def: ProjectionDefinition<TState>,
  eventStore: EventStore,
): Promise<ProjectionOutput<TState>> {
  let state = def.init();
  for await (const event of eventStore.stream()) {
    state = def.apply(state, event);
  }

  const freshness = def.getFreshness(state);
  const hash = hashCanonical({
    name: def.name,
    version: def.version,
    data: state,
    freshness,
  });

  return {
    name: def.name,
    version: def.version,
    data: state,
    freshness,
    hash,
  };
}

export async function rebuildAll(
  registry: ProjectionRegistry,
  eventStore: EventStore,
): Promise<Map<string, ProjectionOutput<unknown>>> {
  const defs = registry.getAll();
  const states = new Map<string, unknown>();

  for (const def of defs) {
    const key = projectionKey(def.name, def.version);
    states.set(key, def.init());
  }

  for await (const event of eventStore.stream()) {
    for (const def of defs) {
      const key = projectionKey(def.name, def.version);
      const current = states.get(key) as unknown;
      const nextState = def.apply(current as never, event);
      states.set(key, nextState);
    }
  }

  const outputs = new Map<string, ProjectionOutput<unknown>>();
  for (const def of defs) {
    const key = projectionKey(def.name, def.version);
    const state = states.get(key) as unknown as object;
    const freshness = def.getFreshness(state as never);
    const hash = hashCanonical({
      name: def.name,
      version: def.version,
      data: state,
      freshness,
    });
    outputs.set(key, {
      name: def.name,
      version: def.version,
      data: state,
      freshness,
      hash,
    });
  }

  return outputs;
}

defaultRegistry
  .register(WorkItemsProjectionDef)
  .register(ReadyQueueProjectionDef)
  .register(RunsProjectionDef)
  .register(ActivePolicyProjectionDef);

export interface WorkLedgerProjections {
  workItems: ReturnType<typeof buildWorkItemsProjectionFromState>;
  readyQueue: ReturnType<typeof buildReadyQueueProjectionFromState>;
  hash: string;
  freshness: {
    workItems: ProjectionFreshness;
    readyQueue: ProjectionFreshness;
  };
}

export interface ExecutionProjections {
  runs: ReturnType<typeof buildRunsProjectionFromState>;
  hash: string;
  freshness: ProjectionFreshness;
}

export async function rebuildWorkLedger(
  eventStore: EventStore,
): Promise<WorkLedgerProjections> {
  const outputs = await rebuildAll(defaultRegistry, eventStore);
  const workItemsState = outputs.get(
    projectionKey(WorkItemsProjectionDef.name, WorkItemsProjectionDef.version),
  )?.data as WorkItemsProjectionState | undefined;
  const readyQueueState = outputs.get(
    projectionKey(
      ReadyQueueProjectionDef.name,
      ReadyQueueProjectionDef.version,
    ),
  )?.data as ReadyQueueProjectionState | undefined;

  if (!workItemsState || !readyQueueState) {
    throw new ValidationError(
      "Work ledger projections missing from registry output",
    );
  }

  const workItems = buildWorkItemsProjectionFromState(workItemsState);
  const readyQueue = buildReadyQueueProjectionFromState(readyQueueState);
  const hash = hashCanonical({ workItems, readyQueue });

  return {
    workItems,
    readyQueue,
    hash,
    freshness: {
      workItems: WorkItemsProjectionDef.getFreshness(workItemsState),
      readyQueue: ReadyQueueProjectionDef.getFreshness(readyQueueState),
    },
  };
}

export async function rebuildRuns(
  eventStore: EventStore,
): Promise<ExecutionProjections> {
  const outputs = await rebuildAll(defaultRegistry, eventStore);
  const runsState = outputs.get(
    projectionKey(RunsProjectionDef.name, RunsProjectionDef.version),
  )?.data as RunsProjectionState | undefined;

  if (!runsState) {
    throw new ValidationError("Runs projection missing from registry output");
  }

  const runs = buildRunsProjectionFromState(runsState);
  const hash = hashCanonical({ runs });

  return {
    runs,
    hash,
    freshness: RunsProjectionDef.getFreshness(runsState),
  };
}
