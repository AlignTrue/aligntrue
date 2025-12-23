import type {
  ProjectionDefinition,
  ProjectionFreshness,
} from "./definition.js";
import type { EventEnvelope } from "../envelopes/index.js";
import {
  EMAIL_EVENT_TYPES,
  type EmailEventEnvelope,
} from "../connectors/google-gmail/events.js";

export const KNOWN_SENDERS_VERSION = "v1";

export const KNOWN_SENDERS_RULES = {
  lookbackDays: 90,
  normalizeEmails: true,
} as const;

export interface KnownSendersProjection {
  senders: Set<string>;
  domains: Set<string>;
  computed_at: string;
  lookback_days: number;
  version: string;
}

export interface KnownSendersProjectionState extends ProjectionFreshness {
  senders: Map<
    string,
    { email: string; first_seen: string; last_seen: string }
  >;
}

export const KnownSendersProjectionDef: ProjectionDefinition<KnownSendersProjectionState> =
  {
    name: "known_senders",
    version: KNOWN_SENDERS_VERSION,
    init(): KnownSendersProjectionState {
      return {
        senders: new Map(),
        last_event_id: null,
        last_ingested_at: null,
      };
    },
    apply(
      state: KnownSendersProjectionState,
      event: EventEnvelope,
    ): KnownSendersProjectionState {
      if (event.event_type !== EMAIL_EVENT_TYPES.EmailMessageIngested) {
        return state;
      }
      const emailEvent = event as EmailEventEnvelope;
      const from = emailEvent.payload.from;
      if (!from) return state;

      const normalized = normalizeEmail(from);
      const existing = state.senders.get(normalized);
      const next = new Map(state.senders);
      next.set(normalized, {
        email: normalized,
        first_seen: existing?.first_seen ?? emailEvent.occurred_at,
        last_seen: emailEvent.occurred_at,
      });

      return {
        senders: next,
        last_event_id: event.event_id,
        last_ingested_at: event.ingested_at,
      };
    },
    getFreshness(state: KnownSendersProjectionState): ProjectionFreshness {
      return {
        last_event_id: state.last_event_id,
        last_ingested_at: state.last_ingested_at,
      };
    },
  };

export function buildKnownSendersProjection(
  state: KnownSendersProjectionState,
  asOf?: string,
): KnownSendersProjection {
  const now = asOf ?? new Date().toISOString();
  const cutoff =
    Date.parse(now) - KNOWN_SENDERS_RULES.lookbackDays * 24 * 60 * 60 * 1000;
  const senders = new Set<string>();
  const domains = new Set<string>();

  for (const [email, record] of state.senders) {
    if (Date.parse(record.last_seen) >= cutoff) {
      senders.add(email);
      const domain = extractDomain(email);
      if (domain) domains.add(domain);
    }
  }

  return {
    senders,
    domains,
    computed_at: now,
    lookback_days: KNOWN_SENDERS_RULES.lookbackDays,
    version: KNOWN_SENDERS_VERSION,
  };
}

function normalizeEmail(email: string): string {
  const match = email.match(/<([^>]+)>/) ?? [null, email];
  return (match[1] ?? email).toLowerCase().trim();
}

function extractDomain(email: string): string | undefined {
  const match = email.match(/@(.+)$/);
  return match?.[1];
}
