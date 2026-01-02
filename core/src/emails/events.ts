import { ValidationError } from "../errors.js";
import { generateEventId } from "../identity/id.js";
import type { EventEnvelope } from "../envelopes/event.js";
import type {
  EmailResolution,
  EmailStatus,
  SliceKind,
  TransitionTrigger,
} from "./types.js";

const EMAIL_EVENTS_ENVELOPE_VERSION = 1;
const EMAIL_STATUS_PAYLOAD_SCHEMA_VERSION = 1;

export const EMAIL_STATUS_EVENT_TYPES = {
  EmailStatusChanged: "email_status_changed",
} as const;

export interface EmailStatusChangedPayload {
  source_ref: string;
  from_status: EmailStatus;
  to_status: EmailStatus;
  trigger: TransitionTrigger;
  resolution?: EmailResolution;
  assessment_id?: string;
  slice_kind?: SliceKind;
  rule_id?: string;
  rule_version?: string;
  reason?: string;
}

export function validateStatusChangePayload(
  payload: EmailStatusChangedPayload,
): void {
  if (payload.trigger === "system" || payload.trigger === "auto_commit") {
    const hasAuditLinkage =
      payload.assessment_id !== undefined || payload.rule_id !== undefined;
    if (!hasAuditLinkage) {
      throw new ValidationError(
        `${payload.trigger} transitions require assessment_id or rule_id for audit`,
      );
    }
    if (payload.assessment_id && !payload.slice_kind) {
      throw new ValidationError(
        "Assessment-driven transitions require slice_kind for audit",
      );
    }
  }
  if (payload.to_status === "processed" && !payload.resolution) {
    throw new ValidationError("Transition to processed requires resolution");
  }
}

export function buildEmailStatusChangedEvent(
  payload: EmailStatusChangedPayload,
  occurred_at: string,
  ingested_at?: string,
): EventEnvelope {
  validateStatusChangePayload(payload);
  const event_id = generateEventId({
    event_type: EMAIL_STATUS_EVENT_TYPES.EmailStatusChanged,
    source_ref: payload.source_ref,
    to_status: payload.to_status,
    assessment_id: payload.assessment_id,
    rule_id: payload.rule_id,
  });
  return {
    event_id,
    event_type: EMAIL_STATUS_EVENT_TYPES.EmailStatusChanged,
    payload,
    occurred_at,
    ingested_at: ingested_at ?? occurred_at,
    envelope_version: EMAIL_EVENTS_ENVELOPE_VERSION,
    payload_schema_version: EMAIL_STATUS_PAYLOAD_SCHEMA_VERSION,
    correlation_id:
      payload.assessment_id ?? payload.rule_id ?? payload.source_ref,
    actor: { actor_id: "system", actor_type: "service" },
  };
}
