/**
 * Receipts Projection
 *
 * Aggregates all AI actions and their receipts for the Supervisor Console.
 * Keyed by source_ref (thread_id, message_id, entity_id) for fast lookup.
 *
 * A receipt captures:
 * - What changed (diff)
 * - Why (rationale + confidence)
 * - What AI looked at (query artifact)
 * - Who acted (actor + capability)
 * - Safety class (READ, WRITE_INTERNAL, WRITE_EXTERNAL_SIDE_EFFECT)
 * - Timing (occurred_at, ingested_at, processed_at)
 */

import type {
  ProjectionDefinition,
  ProjectionFreshness,
} from "./definition.js";
import type { EventEnvelope } from "../envelopes/event.js";
import { hashCanonical } from "../identity/hash.js";
import { SafetyClass } from "../safety-classes/types.js";
import { EMAIL_STATUS_EVENT_TYPES } from "../emails/events.js";
import type { EmailStatusChangedPayload } from "../emails/events.js";
import { GMAIL_MUTATION_EVENT_TYPES } from "../gmail-mutations/events.js";

export type ReceiptKind =
  | "status_change"
  | "gmail_mutation"
  | "task_created"
  | "note_created"
  | "assessment"
  | "suggestion";

export interface Receipt {
  receipt_id: string;
  kind: ReceiptKind;
  source_ref: string; // thread_id, message_id, entity_id
  safety_class: SafetyClass;

  // What changed
  diff: {
    field: string;
    from?: string;
    to: string;
  }[];

  // Why
  rationale?: string;
  confidence?: number;
  assessment_id?: string;

  // What AI looked at
  query_artifact_id?: string;
  context_refs?: string[];

  // Who acted
  actor_id: string;
  actor_type: string;
  capability?: string;

  // Timing
  occurred_at: string;
  ingested_at: string;
  processed_at?: string;

  // External action details
  destination_ref?: string;
  operation?: string;
  approved?: boolean;
  reason?: string;
}

export interface ReceiptsProjection {
  receipts: Receipt[];
  by_source_ref: Map<string, Receipt[]>;
}

export interface ReceiptsProjectionState extends ProjectionFreshness {
  receipts: Map<string, Receipt>;
  by_source_ref: Map<string, Set<string>>; // source_ref -> receipt_ids
}

export const ReceiptsProjectionDef: ProjectionDefinition<ReceiptsProjectionState> =
  {
    name: "receipts",
    version: "1.0.0",
    init(): ReceiptsProjectionState {
      return {
        receipts: new Map(),
        by_source_ref: new Map(),
        last_event_id: null,
        last_ingested_at: null,
      };
    },
    apply(
      state: ReceiptsProjectionState,
      event: EventEnvelope,
    ): ReceiptsProjectionState {
      switch (event.event_type) {
        case EMAIL_STATUS_EVENT_TYPES.EmailStatusChanged: {
          const payload = event.payload as EmailStatusChangedPayload;
          const receipt = buildStatusChangeReceipt(event, payload);
          return addReceipt(state, receipt, event);
        }
        case GMAIL_MUTATION_EVENT_TYPES.GmailMutationSucceeded:
        case GMAIL_MUTATION_EVENT_TYPES.GmailMutationFailed: {
          const receipt = buildGmailMutationReceipt(event);
          return addReceipt(state, receipt, event);
        }
        default:
          return state;
      }
    },
    getFreshness(state: ReceiptsProjectionState): ProjectionFreshness {
      return {
        last_event_id: state.last_event_id,
        last_ingested_at: state.last_ingested_at,
      };
    },
  };

function addReceipt(
  state: ReceiptsProjectionState,
  receipt: Receipt,
  event: EventEnvelope,
): ReceiptsProjectionState {
  const nextReceipts = new Map(state.receipts);
  nextReceipts.set(receipt.receipt_id, receipt);

  const nextBySourceRef = new Map(state.by_source_ref);
  const existing = nextBySourceRef.get(receipt.source_ref) ?? new Set();
  const nextSet = new Set(existing);
  nextSet.add(receipt.receipt_id);
  nextBySourceRef.set(receipt.source_ref, nextSet);

  return {
    receipts: nextReceipts,
    by_source_ref: nextBySourceRef,
    last_event_id: event.event_id,
    last_ingested_at: event.ingested_at,
  };
}

function buildStatusChangeReceipt(
  event: EventEnvelope,
  payload: EmailStatusChangedPayload,
): Receipt {
  const isExternalTrigger = payload.trigger === "human";
  const safetyClass = isExternalTrigger
    ? SafetyClass.WriteExternalSideEffect
    : SafetyClass.WriteInternal;

  const receipt: Receipt = {
    receipt_id: event.event_id,
    kind: "status_change",
    source_ref: payload.source_ref,
    safety_class: safetyClass,
    diff: [
      {
        field: "status",
        from: payload.from_status,
        to: payload.to_status,
      },
      ...(payload.resolution
        ? [{ field: "resolution", to: payload.resolution }]
        : []),
    ],
    actor_id: event.actor?.actor_id ?? "unknown",
    actor_type: event.actor?.actor_type ?? "unknown",
    occurred_at: event.occurred_at,
    ingested_at: event.ingested_at,
  };

  return {
    ...receipt,
    ...(payload.reason ? { rationale: payload.reason } : {}),
    ...(payload.assessment_id ? { assessment_id: payload.assessment_id } : {}),
    ...(payload.slice_kind ? { capability: payload.slice_kind } : {}),
  };
}

function buildGmailMutationReceipt(event: EventEnvelope): Receipt {
  const payload = event.payload as {
    mutation_id: string;
    operation: string;
    message_id: string;
    thread_id: string;
    destination_ref?: string;
    reason?: string;
    completed_at?: string;
  };

  const isSuccess =
    event.event_type === GMAIL_MUTATION_EVENT_TYPES.GmailMutationSucceeded;

  const receipt: Receipt = {
    receipt_id: event.event_id,
    kind: "gmail_mutation",
    source_ref: payload.thread_id ?? payload.message_id,
    safety_class: SafetyClass.WriteExternalSideEffect,
    diff: [
      {
        field: "gmail_operation",
        to: payload.operation,
      },
    ],
    actor_id: event.actor?.actor_id ?? "system",
    actor_type: event.actor?.actor_type ?? "service",
    operation: payload.operation,
    approved: isSuccess,
    occurred_at: event.occurred_at,
    ingested_at: event.ingested_at,
  };

  return {
    ...receipt,
    ...(payload.reason
      ? { rationale: payload.reason, reason: payload.reason }
      : {}),
    ...(payload.destination_ref
      ? { destination_ref: payload.destination_ref }
      : {}),
    ...(payload.completed_at ? { processed_at: payload.completed_at } : {}),
  };
}

export function buildReceiptsProjectionFromState(
  state: ReceiptsProjectionState,
): ReceiptsProjection {
  const receipts = Array.from(state.receipts.values()).sort((a, b) => {
    if (a.occurred_at === b.occurred_at) {
      return a.receipt_id.localeCompare(b.receipt_id);
    }
    return a.occurred_at > b.occurred_at ? -1 : 1;
  });

  const by_source_ref = new Map<string, Receipt[]>();
  for (const [source_ref, receipt_ids] of state.by_source_ref) {
    const receiptList: Receipt[] = [];
    for (const id of receipt_ids) {
      const receipt = state.receipts.get(id);
      if (receipt) {
        receiptList.push(receipt);
      }
    }
    receiptList.sort((a, b) => (a.occurred_at > b.occurred_at ? -1 : 1));
    by_source_ref.set(source_ref, receiptList);
  }

  return { receipts, by_source_ref };
}

export function getReceiptsForSourceRef(
  projection: ReceiptsProjection,
  source_ref: string,
): Receipt[] {
  return projection.by_source_ref.get(source_ref) ?? [];
}

export function hashReceiptsProjection(projection: ReceiptsProjection): string {
  return hashCanonical({ receipts: projection.receipts });
}
