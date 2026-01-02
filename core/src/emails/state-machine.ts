import { EMAIL_EVENT_TYPES } from "./gmail-contracts.js";
import type { EventEnvelope } from "../envelopes/event.js";
import type { EmailEventEnvelope } from "./gmail-contracts.js";
import type {
  EmailStatus,
  TransitionTrigger,
  EmailResolution,
} from "./types.js";
import {
  EMAIL_STATUS_EVENT_TYPES,
  type EmailStatusChangedPayload,
  validateStatusChangePayload,
} from "./events.js";
import { isTransitionAllowed } from "./types.js";
import { cloneMapShallow } from "../utils/collections.js";

export interface EmailStatusState {
  source_ref: string;
  status: EmailStatus;
  status_changed_at: string;
  resolution?: EmailResolution;
}

export interface EmailLedgerState {
  emails: Map<string, EmailStatusState>;
}

export function initialState(): EmailLedgerState {
  return { emails: new Map() };
}

export function reduceEvent(
  state: EmailLedgerState,
  event: EventEnvelope,
): EmailLedgerState {
  const next = state;
  switch (event.event_type) {
    case EMAIL_EVENT_TYPES.EmailMessageIngested: {
      const email = event as EmailEventEnvelope;
      if (next.emails.has(email.payload.source_ref)) {
        return next;
      }
      next.emails.set(email.payload.source_ref, {
        source_ref: email.payload.source_ref,
        status: "inbox",
        status_changed_at: email.ingested_at,
      });
      break;
    }
    case EMAIL_STATUS_EVENT_TYPES.EmailStatusChanged: {
      const payload = event.payload as EmailStatusChangedPayload;
      validateStatusChangePayload(payload);
      const existing =
        next.emails.get(payload.source_ref) ??
        ({
          source_ref: payload.source_ref,
          status: "inbox",
          status_changed_at: event.ingested_at,
        } satisfies EmailStatusState);

      if (
        !isTransitionAllowed(
          payload.from_status,
          payload.to_status,
          payload.trigger,
        )
      ) {
        return next;
      }

      if (existing.status !== payload.from_status) {
        return next;
      }

      existing.status = payload.to_status;
      existing.status_changed_at = event.ingested_at;
      if (payload.to_status === "processed" && payload.resolution) {
        existing.resolution = payload.resolution;
      }
      next.emails.set(payload.source_ref, existing);
      break;
    }
    default:
      break;
  }
  return next;
}

export function cloneState(state: EmailLedgerState): EmailLedgerState {
  const emails = cloneMapShallow(state.emails);
  return { emails };
}

export function canTransition(
  state: EmailLedgerState,
  sourceRef: string,
  from: EmailStatus,
  to: EmailStatus,
  trigger: TransitionTrigger,
): boolean {
  const existing = state.emails.get(sourceRef);
  if (!existing) return false;
  if (existing.status !== from) return false;
  return isTransitionAllowed(from, to, trigger);
}
