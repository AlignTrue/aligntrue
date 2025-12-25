/**
 * Receipts Projection
 *
 * Aggregates all AI actions and their receipts for the Supervisor Console.
 * Keyed by entity_ref (format: "{type}:{id}" e.g., "email_thread:abc123") for fast lookup.
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
import { entityRef } from "../entity-ref.js";

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
  entity_ref: string; // "{type}:{id}" e.g., "email_thread:abc123"
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
  by_entity_ref: Record<string, Receipt[]>;
}

export interface ReceiptsProjectionState extends ProjectionFreshness {
  receipts: Map<string, Receipt>;
  by_entity_ref: Map<string, Set<string>>; // entity_ref -> receipt_ids
}

export const ReceiptsProjectionDef: ProjectionDefinition<ReceiptsProjectionState> =
  {
    name: "receipts",
    version: "1.0.0",
    init(): ReceiptsProjectionState {
      return {
        receipts: new Map(),
        by_entity_ref: new Map(),
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

  const nextByEntityRef = new Map(state.by_entity_ref);
  const existing = nextByEntityRef.get(receipt.entity_ref) ?? new Set();
  const nextSet = new Set(existing);
  nextSet.add(receipt.receipt_id);
  nextByEntityRef.set(receipt.entity_ref, nextSet);

  return {
    receipts: nextReceipts,
    by_entity_ref: nextByEntityRef,
    last_event_id: event.event_id,
    last_ingested_at: event.ingested_at,
  };
}

function buildStatusChangeReceipt(
  event: EventEnvelope,
  payload: EmailStatusChangedPayload,
): Receipt {
  const isExternalTrigger = payload.trigger !== "human";
  const safetyClass = isExternalTrigger
    ? SafetyClass.WriteExternalSideEffect
    : SafetyClass.WriteInternal;

  const receipt: Receipt = {
    receipt_id: event.event_id,
    kind: "status_change",
    entity_ref: entityRef("email_thread", payload.source_ref),
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
    entity_ref: entityRef("email_thread", payload.thread_id),
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

  const by_entity_ref: Record<string, Receipt[]> = {};
  for (const [entity_ref, receipt_ids] of state.by_entity_ref) {
    const receiptList: Receipt[] = [];
    for (const id of receipt_ids) {
      const receipt = state.receipts.get(id);
      if (receipt) {
        receiptList.push(receipt);
      }
    }
    receiptList.sort((a, b) => {
      if (a.occurred_at === b.occurred_at) {
        return a.receipt_id.localeCompare(b.receipt_id);
      }
      return a.occurred_at > b.occurred_at ? -1 : 1;
    });
    by_entity_ref[entity_ref] = receiptList;
  }

  return { receipts, by_entity_ref };
}

export function getReceiptsForEntity(
  projection: ReceiptsProjection,
  entity_ref: string,
): Receipt[] {
  return projection.by_entity_ref[entity_ref] ?? [];
}

export function hashReceiptsProjection(projection: ReceiptsProjection): string {
  return hashCanonical({ receipts: projection.receipts });
}
