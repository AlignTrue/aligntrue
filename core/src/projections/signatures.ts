import { canonicalize } from "../identity/canonicalize.js";
import { deterministicId } from "../identity/id.js";
import type { TrajectoryEvent } from "../trajectories/envelope.js";
import type { OutcomeRecorded } from "../trajectories/outcome.js";
import type {
  TrajectoryProjectionDefinition,
  TrajectoryProjectionFreshness,
} from "./trajectory-definition.js";
import type { ToolCallSummary } from "../trajectories/steps.js";

type NodeId = string;

export interface SignatureState {
  adjacency: Map<NodeId, Set<NodeId>>;
  node_labels: Map<NodeId, string>;
  entity_signatures: Map<string, string>;
  signature_index: Map<string, string[]>;
  entity_outcomes: Map<string, Map<string, number>>;
  trajectory_step_counts: Map<string, number>;
  trajectory_outcomes: Map<string, string>;
  freshness: TrajectoryProjectionFreshness;
}

function emptySignatureState(): SignatureState {
  return {
    adjacency: new Map(),
    node_labels: new Map(),
    entity_signatures: new Map(),
    signature_index: new Map(),
    entity_outcomes: new Map(),
    trajectory_step_counts: new Map(),
    trajectory_outcomes: new Map(),
    freshness: {
      last_trajectory_id: null,
      last_step_id: null,
      last_outcome_id: null,
      rebuilt_at: new Date().toISOString(),
    },
  };
}

export const SignatureProjectionDef: TrajectoryProjectionDefinition<SignatureState> =
  {
    name: "trajectory_signatures",
    version: "1.0.0",
    init: emptySignatureState,
    applyStep(state, step) {
      const trajNode = trajectoryNode(step.trajectory_id);
      incrementStepCount(state, step.trajectory_id);
      addNode(state, trajNode, trajectoryLabel(step.trajectory_id));

      const entityRefs = (step.refs?.entity_refs ?? []).map((r) => r.ref);
      const uniqEntities = Array.from(new Set(entityRefs)).sort();
      for (const ref of uniqEntities) {
        const entNode = entityNode(ref);
        addNode(state, entNode, entityLabel(ref, state));
        // co-occurs edge within same trajectory
        connect(state, entNode, trajNode);
      }

      if (step.step_type === "tool_called") {
        const toolName = (step.payload as ToolCallSummary).tool_name;
        if (toolName) {
          const toolNode = toolNodeId(toolName);
          addNode(state, toolNode, toolLabel(toolName));
          connect(state, trajNode, toolNode);
        }
      }

      state.freshness.last_trajectory_id = step.trajectory_id;
      state.freshness.last_step_id = step.step_id;
      return state;
    },
    applyOutcome(state, outcome) {
      const trajId = outcome.attaches_to.trajectory_id;
      if (trajId) {
        state.trajectory_outcomes.set(trajId, outcome.kind);
      }
      const entities = extractEntityRefsFromOutcome(outcome);
      for (const ref of entities) {
        const byKind =
          state.entity_outcomes.get(ref) ?? new Map<string, number>();
        byKind.set(outcome.kind, (byKind.get(outcome.kind) ?? 0) + 1);
        state.entity_outcomes.set(ref, byKind);
      }
      state.freshness.last_outcome_id = outcome.outcome_id;
      return state;
    },
    getFreshness(state) {
      return state.freshness;
    },
  };

export function finalizeSignatures(state: SignatureState): SignatureState {
  // Update trajectory labels with outcome + step count buckets
  for (const trajId of state.trajectory_step_counts.keys()) {
    const trajNodeId = trajectoryNode(trajId);
    state.node_labels.set(trajNodeId, trajectoryNodeLabel(trajId, state));
  }
  // Update entity labels with outcome distributions
  for (const ent of Array.from(state.entity_outcomes.keys())) {
    state.node_labels.set(entityNode(ent), entityLabel(ent, state));
  }

  const iterations = 3;
  let labels = new Map(state.node_labels);
  for (let i = 0; i < iterations; i += 1) {
    labels = wlIterate(labels, state.adjacency);
  }

  const entityLabels = new Map<string, string>();
  for (const [nodeId, label] of labels) {
    if (nodeId.startsWith("entity:")) {
      const ref = nodeId.slice("entity:".length);
      entityLabels.set(ref, label);
    }
  }

  for (const [ref, label] of entityLabels) {
    const sig = deterministicId(label);
    state.entity_signatures.set(ref, sig);
    const entities = state.signature_index.get(sig) ?? [];
    entities.push(ref);
    entities.sort();
    state.signature_index.set(sig, entities);
  }

  return state;
}

function wlIterate(
  labels: Map<NodeId, string>,
  adjacency: Map<NodeId, Set<NodeId>>,
): Map<NodeId, string> {
  const next = new Map<NodeId, string>();
  const nodes = Array.from(labels.keys()).sort();
  for (const node of nodes) {
    const neighbors = Array.from(adjacency.get(node) ?? []).sort();
    const neighborLabels = neighbors.map((n) => labels.get(n) ?? "");
    const combined = canonicalize({
      self: labels.get(node),
      neighbors: neighborLabels,
    });
    next.set(node, deterministicId(combined));
  }
  return next;
}

function addNode(state: SignatureState, id: NodeId, label: string) {
  if (!state.node_labels.has(id)) {
    state.node_labels.set(id, label);
  }
  if (!state.adjacency.has(id)) {
    state.adjacency.set(id, new Set());
  }
}

function connect(state: SignatureState, a: NodeId, b: NodeId) {
  state.adjacency.get(a)?.add(b);
  state.adjacency.get(b)?.add(a);
}

function entityNode(ref: string): NodeId {
  return `entity:${ref}`;
}
function trajectoryNode(id: string): NodeId {
  return `trajectory:${id}`;
}
function toolNodeId(name: string): NodeId {
  return `tool:${name}`;
}

function trajectoryNodeLabel(trajId: string, state: SignatureState): string {
  const stepCount = state.trajectory_step_counts.get(trajId) ?? 0;
  const bucket = bucketize(stepCount, [0, 1, 2, 4, 8, 16]);
  const outcome = state.trajectory_outcomes.get(trajId) ?? "unknown";
  return deterministicId(canonicalize({ type: "trajectory", bucket, outcome }));
}

function bucketize(value: number, cuts: number[]): string {
  for (const cut of cuts) {
    if (value <= cut) return `${cut}`;
  }
  return `${cuts[cuts.length - 1]}+`;
}

function entityLabel(ref: string, state: SignatureState): string {
  const type = ref.split(":")[0] ?? "entity";
  const degree = state.adjacency.get(entityNode(ref))?.size ?? 0;
  const degreeBucket = bucketize(degree, [0, 1, 2, 4, 8, 16]);
  const outcomes = state.entity_outcomes.get(ref) ?? new Map();
  const outcomeHash = deterministicId(
    canonicalize(Array.from(outcomes.entries()).sort()),
  );
  return deterministicId(
    canonicalize({ type, degree: degreeBucket, outcomes: outcomeHash }),
  );
}

function trajectoryLabel(trajId: string): string {
  return deterministicId(canonicalize({ type: "trajectory", id: trajId }));
}

function toolLabel(name: string): string {
  return deterministicId(canonicalize({ type: "tool", name }));
}

function incrementStepCount(state: SignatureState, trajId: string) {
  state.trajectory_step_counts.set(
    trajId,
    (state.trajectory_step_counts.get(trajId) ?? 0) + 1,
  );
}

function extractEntityRefsFromOutcome(outcome: OutcomeRecorded): string[] {
  const refs = outcome.refs?.entity_refs ?? [];
  return Array.from(new Set(refs.map((r) => r.ref))).sort();
}

export type { TrajectoryEvent, OutcomeRecorded };
