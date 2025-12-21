import { PreconditionFailed, ValidationError } from "../errors.js";
import type {
  CommandEnvelope,
  CommandOutcome,
  EventEnvelope,
} from "../envelopes/index.js";
import { generateEventId } from "../identity/id.js";
import type { CommandLog, EventStore } from "../storage/interfaces.js";
import {
  NOTE_EVENT_TYPES,
  NOTES_SCHEMA_VERSION,
  type NoteCreatedPayload,
  type NoteEvent,
  type NoteEventType,
  type NotePatchedPayload,
  type NoteUpdatedPayload,
} from "./events.js";
import {
  initialState,
  reduceEvent,
  type NoteState,
  type NotesLedgerState,
} from "./state-machine.js";
import { contentHash, toggleCheckboxAtLine } from "./markdown.js";

export type NoteCommandType =
  | "note.create"
  | "note.update"
  | "note.patch_checkbox";

export type NoteCommandPayload =
  | NoteCreatedPayload
  | NoteUpdatedPayload
  | { note_id: string; line_index: number };

export type NoteCommandEnvelope<T extends NoteCommandType = NoteCommandType> =
  CommandEnvelope<T, NoteCommandPayload>;

export interface NoteCommandContext {
  readonly eventStore: EventStore;
  readonly commandLog: CommandLog;
  readonly now?: () => string;
}

export class NoteLedger {
  private readonly now: () => string;

  constructor(
    private readonly eventStore: EventStore,
    private readonly commandLog: CommandLog,
    opts?: { now?: () => string },
  ) {
    this.now = opts?.now ?? (() => new Date().toISOString());
  }

  async execute(
    command: CommandEnvelope<NoteCommandType, NoteCommandPayload>,
  ): Promise<CommandOutcome> {
    const existing = await this.commandLog.getByIdempotencyKey(
      command.command_id,
    );
    if (existing) {
      return existing;
    }

    await this.commandLog.record(command);
    const state = await this.loadState();
    const { events, reason, outcomeStatus } = this.applyCommand(command, state);

    for (const event of events) {
      await this.eventStore.append(event);
    }

    const outcome: CommandOutcome = {
      command_id: command.command_id,
      status:
        outcomeStatus ?? (events.length > 0 ? "accepted" : "already_processed"),
      produced_events: events.map((e) => e.event_id),
      completed_at: this.now(),
      ...(reason ? { reason } : {}),
    };

    await this.commandLog.recordOutcome(outcome);
    return outcome;
  }

  private applyCommand(
    command: CommandEnvelope<NoteCommandType, NoteCommandPayload>,
    state: NotesLedgerState,
  ): {
    events: NoteEvent[];
    reason?: string | undefined;
    outcomeStatus?: CommandOutcome["status"] | undefined;
  } {
    switch (command.command_type) {
      case "note.create":
        return this.handleCreate(
          command as CommandEnvelope<"note.create", NoteCreatedPayload>,
          state,
        );
      case "note.update":
        return this.handleUpdate(
          command as CommandEnvelope<"note.update", NoteUpdatedPayload>,
          state,
        );
      case "note.patch_checkbox":
        return this.handlePatchCheckbox(
          command as CommandEnvelope<
            "note.patch_checkbox",
            { note_id: string; line_index: number }
          >,
          state,
        );
      default:
        throw new ValidationError(
          `Unsupported command type: ${command.command_type}`,
        );
    }
  }

  private handleCreate(
    command: CommandEnvelope<"note.create", NoteCreatedPayload>,
    state: NotesLedgerState,
  ): {
    events: NoteEvent[];
    reason?: string;
    outcomeStatus?: CommandOutcome["status"];
  } {
    if (state.notes.has(command.payload.note_id)) {
      throw new PreconditionFailed("missing", "exists");
    }

    const body_md = command.payload.body_md ?? "";
    const payload: NoteCreatedPayload = {
      ...command.payload,
      body_md,
      content_hash: contentHash(body_md),
    };

    const event = this.buildEvent(
      command,
      NOTE_EVENT_TYPES.NoteCreated,
      payload,
    ) as NoteEvent;
    reduceEvent(state, event);
    return { events: [event] };
  }

  private handleUpdate(
    command: CommandEnvelope<"note.update", NoteUpdatedPayload>,
    state: NotesLedgerState,
  ): {
    events: NoteEvent[];
    reason?: string;
    outcomeStatus?: CommandOutcome["status"];
  } {
    const existing = state.notes.get(command.payload.note_id);
    if (!existing) {
      throw new PreconditionFailed("exists", "missing");
    }

    const hasChange =
      command.payload.title !== undefined ||
      command.payload.body_md !== undefined ||
      command.payload.source_ref !== undefined;

    if (!hasChange) {
      return { events: [], outcomeStatus: "already_processed" };
    }

    const body_md =
      command.payload.body_md !== undefined
        ? command.payload.body_md
        : existing.body_md;
    const content_hash =
      command.payload.body_md !== undefined
        ? contentHash(body_md)
        : existing.content_hash;

    const payload: NoteUpdatedPayload = {
      note_id: command.payload.note_id,
      ...(command.payload.title !== undefined
        ? { title: command.payload.title }
        : {}),
      ...(command.payload.body_md !== undefined ? { body_md } : {}),
      ...(command.payload.body_md !== undefined ? { content_hash } : {}),
      ...(command.payload.source_ref !== undefined
        ? { source_ref: command.payload.source_ref }
        : {}),
    };

    const event = this.buildEvent(
      command,
      NOTE_EVENT_TYPES.NoteUpdated,
      payload,
    ) as NoteEvent;
    reduceEvent(state, event);
    return { events: [event] };
  }

  private handlePatchCheckbox(
    command: CommandEnvelope<
      "note.patch_checkbox",
      { note_id: string; line_index: number }
    >,
    state: NotesLedgerState,
  ): {
    events: NoteEvent[];
    reason?: string;
    outcomeStatus?: CommandOutcome["status"];
  } {
    const existing = state.notes.get(command.payload.note_id);
    if (!existing) {
      throw new PreconditionFailed("exists", "missing");
    }

    let nextBody: string;
    let beforeLine: string;
    let afterLine: string;
    try {
      const toggled = toggleCheckboxAtLine(
        existing.body_md,
        command.payload.line_index,
      );
      nextBody = toggled.nextBody;
      beforeLine = toggled.beforeLine;
      afterLine = toggled.afterLine;
    } catch (err) {
      throw new ValidationError(
        err instanceof Error ? err.message : "Invalid checkbox toggle",
      );
    }

    if (nextBody === existing.body_md) {
      return { events: [], outcomeStatus: "already_processed" };
    }

    const payload: NotePatchedPayload = {
      note_id: existing.id,
      body_md: nextBody,
      content_hash: contentHash(nextBody),
      patch: {
        line_index: command.payload.line_index,
        before: beforeLine,
        after: afterLine,
      },
    };

    const event = this.buildEvent(
      command,
      NOTE_EVENT_TYPES.NotePatched,
      payload,
    ) as NoteEvent;
    reduceEvent(state, event);
    return { events: [event] };
  }

  private async loadState(): Promise<NotesLedgerState> {
    const state = initialState();
    for await (const event of this.eventStore.stream()) {
      reduceEvent(state, event as NoteEvent);
    }
    return state;
  }

  private buildEvent<TPayload>(
    command: CommandEnvelope<NoteCommandType, NoteCommandPayload>,
    eventType: NoteEvent["event_type"],
    payload: TPayload,
  ): EventEnvelope<NoteEventType, TPayload> {
    const timestamp = this.now();
    return {
      event_id: generateEventId({ eventType, payload }),
      event_type: eventType,
      payload,
      occurred_at: command.requested_at ?? timestamp,
      ingested_at: timestamp,
      correlation_id: command.correlation_id,
      causation_id: command.command_id,
      source_ref: command.target_ref,
      actor: command.actor,
      capability_scope: [],
      schema_version: NOTES_SCHEMA_VERSION,
    };
  }
}

export type { NoteState, NotesLedgerState };
