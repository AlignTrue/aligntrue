import { join } from "node:path";
import {
  ValidationError,
  PreconditionFailed,
  Storage,
  OPS_DATA_DIR,
  BaseLedger,
  Identity,
} from "@aligntrue/core";
import type { CommandEnvelope, CommandOutcome } from "@aligntrue/core";
import {
  NOTE_COMMAND_TYPES,
  type NoteCommandType,
  type NoteCreatedPayload,
  type NoteUpdatedPayload,
  type NotePatchedPayload,
} from "@aligntrue/core/contracts/notes";
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
  OPS_DATA_DIR,
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
    opts?.commandsPath ?? join(OPS_DATA_DIR, "ops-core-notes-commands.jsonl"),
    opts?.outcomesPath ?? join(OPS_DATA_DIR, "ops-core-notes-outcomes.jsonl"),
    { allowExternalPaths: opts?.allowExternalPaths },
  );
  return new NoteLedger(
    eventStore,
    commandLog,
    opts?.now ? { now: opts.now } : undefined,
  );
}

export class NoteLedger extends BaseLedger<
  NotesLedgerState,
  NoteCommandEnvelope<NoteCommandType>,
  NoteEvent
> {
  constructor(
    eventStore: Storage.EventStore,
    commandLog: Storage.CommandLog,
    opts?: { now?: () => string },
  ) {
    super(eventStore, commandLog, opts);
  }

  protected override initialState(): NotesLedgerState {
    return initialState();
  }

  protected override reduceEvent(
    state: NotesLedgerState,
    event: NoteEvent,
  ): NotesLedgerState {
    return reduceEvent(state, event);
  }

  protected override envelopeVersion(): number {
    return 1;
  }

  protected override payloadSchemaVersion(): number {
    return NOTES_SCHEMA_VERSION;
  }

  protected override applyCommand(
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
}
