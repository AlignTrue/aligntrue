import { join } from "node:path";
import {
  Identity,
  ValidationError,
  PreconditionFailed,
  Storage,
} from "@aligntrue/ops-core";
import type {
  CommandEnvelope,
  CommandOutcome,
  CommandLog,
  EventStore,
  EventEnvelope,
} from "@aligntrue/ops-core";
import {
  NOTE_COMMAND_TYPES,
  type NoteCommandType,
  type NoteCreatedPayload,
  type NoteUpdatedPayload,
  type NotePatchedPayload,
} from "@aligntrue/ops-core/contracts/notes";
import {
  NOTE_EVENT_TYPES,
  NOTES_SCHEMA_VERSION,
  type NoteEvent,
} from "./events.js";
import {
  initialState,
  reduceEvent,
  type NotesLedgerState,
} from "./state-machine.js";
import { toggleCheckboxAtLine } from "./markdown.js";

const NOTE_ENVELOPE_VERSION = 1;
const DEFAULT_DATA_DIR = process.cwd();

export type NoteCommandEnvelopes = {
  [NOTE_COMMAND_TYPES.Create]: CommandEnvelope<
    typeof NOTE_COMMAND_TYPES.Create,
    NoteCreatedPayload
  >;
  [NOTE_COMMAND_TYPES.Update]: CommandEnvelope<
    typeof NOTE_COMMAND_TYPES.Update,
    NoteUpdatedPayload
  >;
  [NOTE_COMMAND_TYPES.PatchCheckbox]: CommandEnvelope<
    typeof NOTE_COMMAND_TYPES.PatchCheckbox,
    { note_id: string; line_index: number }
  >;
};

export type NoteCommandEnvelope<T extends NoteCommandType = NoteCommandType> =
  NoteCommandEnvelopes[T];

export type NoteCommandPayload = NoteCommandEnvelope["payload"];
export type { NoteCommandType };

export const DEFAULT_NOTES_EVENTS_PATH = join(
  DEFAULT_DATA_DIR,
  "ops-core-notes.jsonl",
);

export function createJsonlNoteLedger(opts?: {
  eventsPath?: string | undefined;
  commandsPath?: string | undefined;
  outcomesPath?: string | undefined;
  allowExternalPaths?: boolean | undefined;
  now?: (() => string) | undefined;
}) {
  const eventStore = new Storage.JsonlEventStore(
    opts?.eventsPath ?? DEFAULT_NOTES_EVENTS_PATH,
  );
  const commandLog = new Storage.JsonlCommandLog(
    opts?.commandsPath ??
      join(DEFAULT_DATA_DIR, "ops-core-notes-commands.jsonl"),
    opts?.outcomesPath ??
      join(DEFAULT_DATA_DIR, "ops-core-notes-outcomes.jsonl"),
    { allowExternalPaths: opts?.allowExternalPaths },
  );
  return new NoteLedger(
    eventStore,
    commandLog,
    opts?.now ? { now: opts.now } : undefined,
  );
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
    command: NoteCommandEnvelope<NoteCommandType>,
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
    command: CommandEnvelope<string, NoteCommandPayload>,
    state: NotesLedgerState,
  ): {
    events: NoteEvent[];
    reason?: string;
    outcomeStatus?: CommandOutcome["status"];
  } {
    switch (command.command_type) {
      case NOTE_COMMAND_TYPES.Create:
        return this.handleCreate(
          command as NoteCommandEnvelope<typeof NOTE_COMMAND_TYPES.Create>,
          state,
        );
      case NOTE_COMMAND_TYPES.Update:
        return this.handleUpdate(
          command as NoteCommandEnvelope<typeof NOTE_COMMAND_TYPES.Update>,
          state,
        );
      case NOTE_COMMAND_TYPES.PatchCheckbox:
        return this.handlePatchCheckbox(
          command as NoteCommandEnvelope<
            typeof NOTE_COMMAND_TYPES.PatchCheckbox
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
    command: NoteCommandEnvelope<typeof NOTE_COMMAND_TYPES.Create>,
    state: NotesLedgerState,
  ): { events: NoteEvent[] } {
    if (state.notes.has(command.payload.note_id)) {
      throw new PreconditionFailed("missing", "exists");
    }

    const body_md = command.payload.body_md ?? "";
    const payload: NoteCreatedPayload = {
      ...command.payload,
      body_md,
      content_hash: Identity.hashCanonical(body_md),
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
    command: NoteCommandEnvelope<typeof NOTE_COMMAND_TYPES.Update>,
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
        ? Identity.hashCanonical(body_md)
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
    command: NoteCommandEnvelope<typeof NOTE_COMMAND_TYPES.PatchCheckbox>,
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
      content_hash: Identity.hashCanonical(nextBody),
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
    command: CommandEnvelope<string, NoteCommandPayload>,
    eventType: NoteEvent["event_type"],
    payload: TPayload,
  ): EventEnvelope<string, TPayload> {
    const timestamp = this.now();
    const capability_id = command.capability_id ?? command.command_type;
    return {
      event_id: Identity.generateEventId({ eventType, payload }),
      event_type: eventType,
      payload,
      occurred_at: command.requested_at ?? timestamp,
      ingested_at: timestamp,
      correlation_id: command.correlation_id,
      causation_id: command.command_id,
      causation_type: "command",
      actor: command.actor,
      ...(command.target_ref !== undefined
        ? { source_ref: command.target_ref }
        : {}),
      ...(capability_id !== undefined ? { capability_id } : {}),
      envelope_version: NOTE_ENVELOPE_VERSION,
      payload_schema_version: NOTES_SCHEMA_VERSION,
    };
  }
}
