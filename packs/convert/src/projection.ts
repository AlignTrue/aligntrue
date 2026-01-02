import type {
  ProjectionDefinition,
  ProjectionFreshness,
} from "@aligntrue/core";
import type { EventEnvelope } from "@aligntrue/core";
import { Contracts, Identity } from "@aligntrue/core";
type ConversionMeta = Contracts.ConversionMeta;

const { TASK_EVENT_TYPES, NOTE_EVENT_TYPES } = Contracts;

export const CONVERSIONS_PROJECTION = "pack.convert.conversions" as const;

export interface ConversionRecord {
  id: string;
  task_or_note_id: string;
  entity_type: "task" | "note";
  from_source_type: string;
  from_source_ref: string;
  conversion_method: string;
  converted_at: string;
  converted_by: Contracts.ActorRef | undefined;
}

export interface ConversionsProjection {
  conversions: ConversionRecord[];
}

export interface ConversionsProjectionState extends ProjectionFreshness {
  conversions: Map<string, ConversionRecord>;
}

export const ConversionsProjectionDef: ProjectionDefinition<ConversionsProjectionState> =
  {
    name: CONVERSIONS_PROJECTION,
    version: "1.0.0",
    init(): ConversionsProjectionState {
      return {
        conversions: new Map(),
        last_event_id: null,
        last_ingested_at: null,
      };
    },
    apply(
      state: ConversionsProjectionState,
      event: EventEnvelope,
    ): ConversionsProjectionState {
      switch (event.event_type) {
        case TASK_EVENT_TYPES.TaskCreated: {
          const taskEvent = event as EventEnvelope<
            (typeof TASK_EVENT_TYPES)["TaskCreated"],
            Contracts.TaskCreatedPayload
          >;
          const record = buildRecordFromConversion({
            entity_id: taskEvent.payload.task_id,
            entity_type: "task",
            ...(taskEvent.payload.conversion
              ? { conversion: taskEvent.payload.conversion }
              : {}),
            actor: taskEvent.actor,
          });
          if (!record) return state;
          return upsertRecord(state, record, event);
        }
        case NOTE_EVENT_TYPES.NoteCreated: {
          const noteEvent = event as EventEnvelope<
            (typeof NOTE_EVENT_TYPES)["NoteCreated"],
            Contracts.NoteCreatedPayload
          >;
          const record = buildRecordFromConversion({
            entity_id: noteEvent.payload.note_id,
            entity_type: "note",
            ...(noteEvent.payload.conversion
              ? { conversion: noteEvent.payload.conversion }
              : {}),
            actor: noteEvent.actor,
          });
          if (!record) return state;
          return upsertRecord(state, record, event);
        }
        default:
          return state;
      }
    },
    getFreshness(state: ConversionsProjectionState): ProjectionFreshness {
      return {
        last_event_id: state.last_event_id,
        last_ingested_at: state.last_ingested_at,
      };
    },
  };

function buildRecordFromConversion(opts: {
  entity_id: string;
  entity_type: "task" | "note";
  conversion?: ConversionMeta;
  actor: Contracts.ActorRef | undefined;
}): ConversionRecord | undefined {
  if (!opts.conversion) return undefined;
  const conversion = opts.conversion;
  const id = Identity.hashCanonical({
    entity: opts.entity_id,
    entity_type: opts.entity_type,
    conversion,
  });
  return {
    id,
    task_or_note_id: opts.entity_id,
    entity_type: opts.entity_type,
    from_source_type: conversion.from_source_type,
    from_source_ref: conversion.from_source_ref,
    conversion_method: conversion.conversion_method,
    converted_at: conversion.converted_at,
    converted_by: opts.actor,
  };
}

function upsertRecord(
  state: ConversionsProjectionState,
  record: ConversionRecord,
  event: EventEnvelope,
): ConversionsProjectionState {
  const next = new Map(state.conversions);
  next.set(record.id, record);
  return {
    conversions: next,
    last_event_id: event.event_id,
    last_ingested_at: event.ingested_at,
  };
}

export function buildConversionsProjectionFromState(
  state: ConversionsProjectionState,
): ConversionsProjection {
  const conversions = Array.from(state.conversions.values()).sort((a, b) => {
    if (a.converted_at === b.converted_at) {
      return a.id.localeCompare(b.id);
    }
    return a.converted_at > b.converted_at ? -1 : 1;
  });
  return { conversions };
}

export function hashConversionsProjection(
  projection: ConversionsProjection,
): string {
  return Identity.hashCanonical(projection);
}
