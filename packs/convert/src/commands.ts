import type {
  PackCommandHandler,
  EventStore,
  EventEnvelope,
  CommandOutcome,
} from "@aligntrue/core";
import {
  Contracts,
  Identity,
  OPS_TASKS_ENABLED,
  OPS_NOTES_ENABLED,
  Emails,
} from "@aligntrue/core";

const {
  CONVERT_COMMAND_TYPES,
  TASK_COMMAND_TYPES,
  NOTE_COMMAND_TYPES,
  EMAIL_EVENT_TYPES,
} = { ...Contracts, ...Emails };

type ConvertPayload =
  | Contracts.ConvertEmailToTaskPayload
  | Contracts.ConvertEmailToNotePayload;

function mapConversionMethod(
  method: ConvertPayload["conversion_method"],
): Contracts.ConversionMeta["conversion_method"] {
  switch (method) {
    case "user_action":
      return "user_action";
    case "suggestion":
      return "ai_suggestion_accepted";
    case "rule":
      return "rule_triggered";
    default:
      return "user_action";
  }
}

export const commandHandlers: Record<string, PackCommandHandler> = {
  [CONVERT_COMMAND_TYPES.EmailToTask]: async (command, context) => {
    if (!OPS_TASKS_ENABLED) {
      return {
        command_id: command.command_id,
        status: "rejected",
        reason: "Tasks are disabled",
      };
    }
    const payload = command.payload as Contracts.ConvertEmailToTaskPayload;
    const email = await findEmail(context.eventStore, payload);
    if (!email) {
      return {
        command_id: command.command_id,
        status: "failed",
        reason: "Email not found for conversion",
      };
    }

    const now = new Date().toISOString();
    const source_ref = payload.source_ref ?? email.payload.source_ref;
    const task_id = Identity.deterministicId({ source_ref, op: "to_task" });
    const conversion: Contracts.ConversionMeta = {
      from_source_type: "email",
      from_source_ref: source_ref,
      conversion_method: mapConversionMethod(payload.conversion_method),
      converted_at: now,
    };

    const taskPayload: Contracts.TaskCreatedPayload = {
      task_id,
      title: payload.title ?? email.payload.subject ?? "(no subject)",
      bucket: "today",
      status: "open",
      ...(source_ref ? { source_ref } : {}),
      conversion,
    };

    const childOutcome = await context.dispatchChild({
      command_type: TASK_COMMAND_TYPES.Create,
      payload: taskPayload,
      target_ref: `task:${task_id}`,
      dedupe_scope: "target",
      capability_id: TASK_COMMAND_TYPES.Create,
    });

    return normalizeOutcome(command.command_id, childOutcome);
  },

  [CONVERT_COMMAND_TYPES.EmailToNote]: async (command, context) => {
    if (!OPS_NOTES_ENABLED) {
      return {
        command_id: command.command_id,
        status: "rejected",
        reason: "Notes are disabled",
      };
    }
    const payload = command.payload as Contracts.ConvertEmailToNotePayload;
    const email = await findEmail(context.eventStore, payload);
    if (!email) {
      return {
        command_id: command.command_id,
        status: "failed",
        reason: "Email not found for conversion",
      };
    }

    const now = new Date().toISOString();
    const source_ref = payload.source_ref ?? email.payload.source_ref;
    const note_id = Identity.deterministicId({ source_ref, op: "to_note" });
    const conversion: Contracts.ConversionMeta = {
      from_source_type: "email",
      from_source_ref: source_ref,
      conversion_method: mapConversionMethod(payload.conversion_method),
      converted_at: now,
    };

    const body_md =
      payload.body_md ??
      email.payload.snippet ??
      email.payload.subject ??
      "(converted email)";
    const notePayload: Contracts.NoteCreatedPayload = {
      note_id,
      title: payload.title ?? email.payload.subject ?? "Email note",
      body_md,
      content_hash: Identity.hashCanonical(body_md),
      ...(source_ref ? { source_ref } : {}),
      conversion,
    };

    const childOutcome = await context.dispatchChild({
      command_type: NOTE_COMMAND_TYPES.Create,
      payload: notePayload,
      target_ref: `note:${note_id}`,
      dedupe_scope: "target",
      capability_id: NOTE_COMMAND_TYPES.Create,
    });

    return normalizeOutcome(command.command_id, childOutcome);
  },
};

async function findEmail(
  eventStore: EventStore,
  input: ConvertPayload,
): Promise<EventEnvelope<
  (typeof EMAIL_EVENT_TYPES)["EmailMessageIngested"],
  Emails.EmailMessageIngestedPayload
> | null> {
  for await (const event of eventStore.stream()) {
    if (event.event_type !== EMAIL_EVENT_TYPES.EmailMessageIngested) continue;
    const emailEvent = event as EventEnvelope<
      (typeof EMAIL_EVENT_TYPES)["EmailMessageIngested"],
      Emails.EmailMessageIngestedPayload
    >;
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

function normalizeOutcome(
  parentCommandId: string,
  outcome: CommandOutcome,
): CommandOutcome {
  return {
    command_id: parentCommandId,
    status: outcome.status,
    ...(outcome.reason !== undefined ? { reason: outcome.reason } : {}),
    ...(outcome.produced_events !== undefined
      ? { produced_events: outcome.produced_events }
      : {}),
    ...(outcome.child_commands !== undefined
      ? { child_commands: outcome.child_commands }
      : {}),
  };
}
