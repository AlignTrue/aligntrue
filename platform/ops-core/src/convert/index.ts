import { ValidationError } from "../errors.js";
import type { ActorRef } from "../envelopes/actor.js";
import type { CommandEnvelope, CommandOutcome } from "../envelopes/index.js";
import { deterministicId, generateCommandId } from "../identity/index.js";
import type { CommandLog, EventStore } from "../storage/interfaces.js";
import {
  EMAIL_EVENT_TYPES,
  type EmailEventEnvelope,
} from "../emails/gmail-contracts.js";
import {
  TASK_COMMAND_TYPES,
  type TaskCreatedPayload,
} from "../contracts/tasks.js";
import {
  type NoteCommandEnvelope,
  type NoteCreatedPayload,
} from "../notes/commands.js";
import { contentHash } from "../notes/markdown.js";
import type { ConversionMeta } from "../types/conversion.js";
import { OPS_TASKS_ENABLED, OPS_NOTES_ENABLED } from "../config.js";

export interface EmailLookupInput {
  message_id?: string;
  source_ref?: string;
}

export interface ConversionResult<TId extends string> {
  created_id: TId;
  source_ref: string;
  outcome: CommandOutcome;
}

interface BaseConvertOpts {
  actor: ActorRef;
  correlation_id?: string;
  conversion_method?: ConversionMeta["conversion_method"];
}

export interface ConvertEmailToTaskInput
  extends EmailLookupInput, BaseConvertOpts {
  title?: string;
}

export interface ConvertEmailToNoteInput
  extends EmailLookupInput, BaseConvertOpts {
  title?: string;
  body_md?: string;
}

export class ConversionService {
  private readonly now: () => string;
  private readonly tasksEnabled: boolean;
  private readonly notesEnabled: boolean;
  private readonly runtimeDispatch: (
    command: CommandEnvelope,
  ) => Promise<CommandOutcome>;

  constructor(
    private readonly eventStore: EventStore,
    private readonly commandLog: CommandLog,
    opts?: {
      now?: () => string;
      tasksEnabled?: boolean;
      notesEnabled?: boolean;
      runtimeDispatch: (command: CommandEnvelope) => Promise<CommandOutcome>;
    },
  ) {
    this.now = opts?.now ?? (() => new Date().toISOString());
    this.tasksEnabled = opts?.tasksEnabled ?? OPS_TASKS_ENABLED;
    this.notesEnabled = opts?.notesEnabled ?? OPS_NOTES_ENABLED;
    if (!opts?.runtimeDispatch) {
      throw new ValidationError(
        "runtimeDispatch is required for ConversionService",
      );
    }
    this.runtimeDispatch = opts.runtimeDispatch;
  }

  async convertEmailToTask(
    input: ConvertEmailToTaskInput,
  ): Promise<ConversionResult<string>> {
    if (!this.tasksEnabled) {
      throw new ValidationError("Tasks are disabled (OPS_TASKS_ENABLED=0)");
    }
    const email = await this.findEmail(input);
    if (!email) {
      throw new ValidationError("Email not found for conversion");
    }

    const source_ref = email.payload.source_ref;
    const converted_at = this.now();
    const task_id = deterministicId({
      source_ref,
      op: "to_task",
    });
    const conversion: ConversionMeta = {
      from_source_type: "email",
      from_source_ref: source_ref,
      conversion_method: input.conversion_method ?? "user_action",
      converted_at,
    };

    const payload: TaskCreatedPayload = {
      task_id,
      title: input.title ?? email.payload.subject ?? "(no subject)",
      bucket: "today",
      status: "open",
      source_ref,
      conversion,
    };

    const command = this.buildCommand(
      TASK_COMMAND_TYPES.Create,
      payload,
      `task:${task_id}`,
      input,
    );

    const outcome = await this.runtimeDispatch(command);
    return { created_id: task_id, source_ref, outcome };
  }

  async convertEmailToNote(
    input: ConvertEmailToNoteInput,
  ): Promise<ConversionResult<string>> {
    if (!this.notesEnabled) {
      throw new ValidationError("Notes are disabled (OPS_NOTES_ENABLED=0)");
    }
    const email = await this.findEmail(input);
    if (!email) {
      throw new ValidationError("Email not found for conversion");
    }

    const source_ref = email.payload.source_ref;
    const converted_at = this.now();
    const note_id = deterministicId({
      source_ref,
      op: "to_note",
    });
    const conversion: ConversionMeta = {
      from_source_type: "email",
      from_source_ref: source_ref,
      conversion_method: input.conversion_method ?? "user_action",
      converted_at,
    };

    const body_md =
      input.body_md ??
      email.payload.snippet ??
      email.payload.subject ??
      "(converted email)";
    const payload: NoteCreatedPayload = {
      note_id,
      title: input.title ?? email.payload.subject ?? "Email note",
      body_md,
      content_hash: contentHash(body_md),
      source_ref,
      conversion,
    };

    const command: NoteCommandEnvelope<"note.create"> = this.buildCommand(
      "note.create",
      payload,
      `note:${note_id}`,
      input,
    );

    const outcome = await this.runtimeDispatch(command);
    return { created_id: note_id, source_ref, outcome };
  }

  private async findEmail(
    input: EmailLookupInput,
  ): Promise<EmailEventEnvelope | null> {
    for await (const event of this.eventStore.stream()) {
      if (event.event_type !== EMAIL_EVENT_TYPES.EmailMessageIngested) continue;
      const emailEvent = event as EmailEventEnvelope;
      if (
        (input.source_ref &&
          emailEvent.payload.source_ref === input.source_ref) ||
        (input.message_id && emailEvent.payload.message_id === input.message_id)
      ) {
        return emailEvent;
      }
    }
    return null;
  }

  private buildCommand<
    T extends CommandEnvelope["command_type"],
    P extends CommandEnvelope["payload"],
  >(
    command_type: T,
    payload: P,
    target_ref: string,
    input: BaseConvertOpts,
  ): CommandEnvelope<T, P> {
    const requested_at = this.now();
    const idempotency_key = generateCommandId({
      source_type: "email",
      source_ref: (payload as { source_ref?: string }).source_ref,
      op: command_type,
    });
    const command_id = generateCommandId({
      idempotency_key,
      requested_at,
    });
    return {
      command_id,
      idempotency_key,
      command_type,
      payload,
      target_ref,
      dedupe_scope: "target",
      correlation_id: input.correlation_id ?? command_id,
      actor: input.actor,
      requested_at,
    } as CommandEnvelope<T, P>;
  }
}
