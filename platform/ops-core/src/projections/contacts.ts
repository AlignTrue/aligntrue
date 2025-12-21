import type {
  ProjectionDefinition,
  ProjectionFreshness,
} from "./definition.js";
import { OPS_CONTACTS_ENABLED } from "../config.js";
import { deterministicId } from "../identity/id.js";
import type { CalendarEventRecord } from "../connectors/google-calendar/types.js";
import {
  CALENDAR_EVENT_TYPES,
  type CalendarEventEnvelope,
} from "../connectors/google-calendar/events.js";
import type { EventEnvelope } from "../envelopes/index.js";

export interface Contact {
  contact_id: string;
  primary_email?: string;
  display_name?: string;
  source_refs: string[];
  created_at: string;
  updated_at: string;
}

export interface ContactProjection {
  contacts: Contact[];
}

type DisplayPriority = "organizer" | "attendee" | "unknown";

interface ContactInternal extends Contact {
  display_priority: DisplayPriority;
  display_chosen_at: string | null; // occurred_at tie-breaker
  display_source_ref: string | null; // deterministic tie-breaker
}

export interface ContactsProjectionState extends ProjectionFreshness {
  contacts: Map<string, ContactInternal>;
}

export const ContactsProjectionDef: ProjectionDefinition<ContactsProjectionState> =
  {
    name: "contacts",
    version: "1.0.0",
    init(): ContactsProjectionState {
      return {
        contacts: new Map(),
        last_event_id: null,
        last_ingested_at: null,
      };
    },
    apply(
      state: ContactsProjectionState,
      event: EventEnvelope,
    ): ContactsProjectionState {
      // Kill switch: keep projection empty while disabled.
      if (!OPS_CONTACTS_ENABLED) {
        return state;
      }

      if (event.event_type !== CALENDAR_EVENT_TYPES.CalendarItemIngested) {
        return state;
      }

      const calendarEvent = event as CalendarEventEnvelope;
      const next = new Map(state.contacts);

      const candidates = buildContactCandidates(calendarEvent);
      for (const candidate of candidates) {
        const existing = next.get(candidate.contact_id);
        const merged = mergeContact(existing, candidate, calendarEvent);
        next.set(candidate.contact_id, merged);
      }

      return {
        contacts: next,
        last_event_id: event.event_id,
        last_ingested_at: event.ingested_at,
      };
    },
    getFreshness(state: ContactsProjectionState): ProjectionFreshness {
      return {
        last_event_id: state.last_event_id,
        last_ingested_at: state.last_ingested_at,
      };
    },
  };

export function buildContactsProjectionFromState(
  state: ContactsProjectionState,
): ContactProjection {
  const contacts = Array.from(state.contacts.values())
    .map(toPublicContact)
    .sort((a, b) => a.contact_id.localeCompare(b.contact_id));
  return { contacts };
}

export function hashContactIdFromEmail(email: string): string {
  const normalized = normalizeEmail(email);
  return deterministicId({ type: "contact_email", email: normalized });
}

export function hashContactIdSourceScoped(input: {
  provider: CalendarEventRecord["provider"];
  calendar_id: string;
  event_id: string;
  role: "organizer" | "attendee";
  index: number;
}): string {
  return deterministicId({
    type: "contact_source_scoped",
    ...input,
  });
}

function mergeContact(
  existing: ContactInternal | undefined,
  candidate: ContactInternal,
  _event: CalendarEventEnvelope,
): ContactInternal {
  if (!existing) {
    return candidate;
  }

  const source_refs = mergeSourceRefs(
    existing.source_refs,
    candidate.source_refs,
  );
  const created_at =
    existing.created_at <= candidate.created_at
      ? existing.created_at
      : candidate.created_at;
  const updated_at =
    existing.updated_at >= candidate.updated_at
      ? existing.updated_at
      : candidate.updated_at;

  const primary_email =
    existing.primary_email ?? candidate.primary_email ?? undefined;

  const display = chooseDisplay(existing, candidate);

  const merged: ContactInternal = {
    contact_id: existing.contact_id,
    display_priority: display.display_priority,
    display_chosen_at: display.display_chosen_at ?? null,
    display_source_ref: display.display_source_ref ?? null,
    source_refs,
    created_at,
    updated_at,
  };

  if (primary_email) {
    merged.primary_email = primary_email;
  }
  if (display.display_name) {
    merged.display_name = display.display_name;
  }

  return merged;
}

function chooseDisplay(
  left: ContactInternal,
  right: ContactInternal,
): {
  display_name?: string;
  display_priority: DisplayPriority;
  display_chosen_at: string | null;
  display_source_ref: string | null;
} {
  const rank = (p: DisplayPriority): number => {
    if (p === "organizer") return 2;
    if (p === "attendee") return 1;
    return 0;
  };

  // Higher priority wins
  if (rank(right.display_priority) > rank(left.display_priority)) {
    return pick(right);
  }
  if (rank(right.display_priority) < rank(left.display_priority)) {
    return pick(left);
  }

  // Same priority: earlier occurred_at wins, then lexicographic source_ref
  const leftTime = left.display_chosen_at ?? "";
  const rightTime = right.display_chosen_at ?? "";
  if (rightTime && (!leftTime || rightTime < leftTime)) {
    return pick(right);
  }
  if (leftTime && (!rightTime || leftTime < rightTime)) {
    return pick(left);
  }

  const leftRef = left.display_source_ref ?? "";
  const rightRef = right.display_source_ref ?? "";
  if (rightRef && (!leftRef || rightRef < leftRef)) {
    return pick(right);
  }
  return pick(left);
}

function pick(contact: ContactInternal) {
  const base = {
    display_priority: contact.display_priority,
    display_chosen_at: contact.display_chosen_at ?? null,
    display_source_ref: contact.display_source_ref ?? null,
  };
  return contact.display_name
    ? { ...base, display_name: contact.display_name }
    : base;
}

function buildContactCandidates(
  event: CalendarEventEnvelope,
): ContactInternal[] {
  const payload = event.payload;
  const candidates: ContactInternal[] = [];

  if (payload.organizer) {
    const organizerCandidate = buildContactInternal({
      email: payload.organizer,
      display_name: payload.organizer,
      role: "organizer",
      idx: -1,
      event,
    });
    if (organizerCandidate) {
      candidates.push(organizerCandidate);
    }
  }

  if (payload.attendees?.length) {
    payload.attendees.forEach((attendee, idx) => {
      const displayName = attendee.display_name ?? attendee.email;
      const attendeeCandidate = buildContactInternal({
        ...(attendee.email ? { email: attendee.email } : {}),
        ...(displayName ? { display_name: displayName } : {}),
        role: "attendee",
        idx,
        event,
      });
      if (attendeeCandidate) {
        candidates.push(attendeeCandidate);
      }
    });
  }

  return candidates;
}

function buildContactInternal(input: {
  email?: string;
  display_name?: string;
  role: "organizer" | "attendee";
  idx: number;
  event: CalendarEventEnvelope;
}): ContactInternal | null {
  const { email, display_name, role, idx, event } = input;
  const source_refs = event.source_ref ? [event.source_ref] : [];
  const created_at = event.ingested_at;
  const updated_at = event.ingested_at;
  const display_priority: DisplayPriority = role;
  const display_chosen_at =
    event.occurred_at ?? event.payload.start_time ?? null;
  const display_source_ref = event.source_ref ?? null;

  if (email && email.trim().length > 0) {
    const primary_email = normalizeEmail(email);
    const contact_id = hashContactIdFromEmail(primary_email);
    const contact: ContactInternal = {
      contact_id,
      primary_email,
      display_priority,
      display_chosen_at,
      display_source_ref,
      source_refs,
      created_at,
      updated_at,
    };
    contact.display_name = display_name ?? primary_email;
    return contact;
  }

  // Fallback: source-scoped contact when email is missing
  const contact_id = hashContactIdSourceScoped({
    provider: event.payload.provider,
    calendar_id: event.payload.calendar_id,
    event_id: event.payload.event_id,
    role,
    index: idx,
  });
  const contact: ContactInternal = {
    contact_id,
    display_priority: display_priority,
    display_chosen_at,
    display_source_ref,
    source_refs,
    created_at,
    updated_at,
  };
  if (display_name) {
    contact.display_name = display_name;
  }
  return contact;
}

function mergeSourceRefs(a: string[], b: string[]): string[] {
  const set = new Set<string>([...a, ...b]);
  return Array.from(set).sort();
}

function toPublicContact(contact: ContactInternal): Contact {
  const base: Contact = {
    contact_id: contact.contact_id,
    source_refs: contact.source_refs,
    created_at: contact.created_at,
    updated_at: contact.updated_at,
  };
  if (contact.primary_email) {
    base.primary_email = contact.primary_email;
  }
  if (contact.display_name) {
    base.display_name = contact.display_name;
  }
  return base;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function extractContactIdsFromEvent(
  event: CalendarEventEnvelope,
): string[] {
  const ids = buildContactCandidates(event).map((c) => c.contact_id);
  return Array.from(new Set(ids)).sort();
}
