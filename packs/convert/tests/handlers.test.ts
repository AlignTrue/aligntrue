import { describe, it, expect, beforeAll } from "vitest";

let Identity: typeof import("@aligntrue/core").Identity;
let Contracts: typeof import("@aligntrue/core").Contracts;
let Emails: typeof import("@aligntrue/core").Emails;
let commandHandlers: import("../src/index.js").default["commandHandlers"];
let ConversionsProjectionDef: typeof import("../src/projection.js").ConversionsProjectionDef;
let buildConversionsProjectionFromState: typeof import("../src/projection.js").buildConversionsProjectionFromState;
type CommandOutcome = import("@aligntrue/core").CommandOutcome;
type ConversionsProjectionState =
  import("../src/projection.js").ConversionsProjectionState;

async function loadModule() {
  process.env["OPS_TASKS_ENABLED"] = "1";
  process.env["OPS_NOTES_ENABLED"] = "1";
  const core = await import("@aligntrue/core");
  Identity = core.Identity;
  Contracts = core.Contracts;
  Emails = core.Emails;
  const mod = await import("../src/index.js");
  commandHandlers = mod.commandHandlers;
  ConversionsProjectionDef = mod.ConversionsProjectionDef;
  buildConversionsProjectionFromState = mod.buildConversionsProjectionFromState;
}

function makeEmailEvent(id: string, subject = "subj") {
  const occurred_at = new Date().toISOString();
  return {
    event_id: `evt-${id}`,
    event_type: Emails.EMAIL_EVENT_TYPES.EmailMessageIngested,
    payload: {
      source_ref: `email:${id}`,
      message_id: id,
      thread_id: `thr-${id}`,
      internal_date: occurred_at,
      subject,
    },
    occurred_at,
    ingested_at: occurred_at,
    correlation_id: `corr-${id}`,
    actor: { actor_id: "system", actor_type: "service" },
    envelope_version: 1,
    payload_schema_version: 1,
  };
}

function makeCommand(
  type: Contracts.ConvertCommandType,
  payload: Contracts.ConvertCommandPayload,
) {
  const command_id = Identity.randomId();
  const requested_at = new Date().toISOString();
  return {
    command_id,
    idempotency_key: command_id,
    command_type: type,
    payload,
    dedupe_scope: "target",
    target_ref: `email:${payload.message_id ?? payload.source_ref ?? "unknown"}`,
    actor: { actor_id: "tester", actor_type: "human" },
    correlation_id: command_id,
    requested_at,
    capability_id: type,
  } satisfies Contracts.CommandEnvelope;
}

describe("pack-convert command handlers", () => {
  beforeAll(async () => {
    await loadModule();
  });
  it("returns CommandOutcome with command_id and child_commands", async () => {
    const email = makeEmailEvent("1");
    const command = makeCommand(Contracts.CONVERT_COMMAND_TYPES.EmailToTask, {
      message_id: "1",
      conversion_method: "user_action",
    });
    const outcome = await commandHandlers[
      Contracts.CONVERT_COMMAND_TYPES.EmailToTask
    ](command, {
      eventStore: {
        async *stream() {
          yield email;
        },
        append: async () => {},
      },
      dispatchChild: async () =>
        ({
          command_id: "child-1",
          status: "accepted",
          produced_events: ["ev1"],
          child_commands: [],
        }) satisfies CommandOutcome,
    });

    expect(outcome.command_id).toBe(command.command_id);
    expect(outcome.status).toBe("accepted");
  });

  it("is idempotent on duplicate convert", async () => {
    const email = makeEmailEvent("2");
    const command = makeCommand(Contracts.CONVERT_COMMAND_TYPES.EmailToNote, {
      message_id: "2",
      conversion_method: "user_action",
    });
    let callCount = 0;
    const dispatchChild = async () => {
      callCount += 1;
      if (callCount > 1) {
        return {
          command_id: "child-dup",
          status: "already_processed",
          produced_events: [],
        } satisfies CommandOutcome;
      }
      return {
        command_id: "child-new",
        status: "accepted",
        produced_events: ["ev-task"],
      } satisfies CommandOutcome;
    };

    const ctx = {
      eventStore: {
        async *stream() {
          yield email;
        },
        append: async () => {},
      },
      dispatchChild,
    };

    const first = await commandHandlers[
      Contracts.CONVERT_COMMAND_TYPES.EmailToNote
    ](command, ctx);
    const second = await commandHandlers[
      Contracts.CONVERT_COMMAND_TYPES.EmailToNote
    ](command, ctx);

    expect(first.status).toBe("accepted");
    expect(second.status).toBe("already_processed");
  });
});

describe("pack-convert projections", () => {
  beforeAll(async () => {
    if (!ConversionsProjectionDef) {
      await loadModule();
    }
  });
  it("rebuilds conversions deterministically", () => {
    const occurred_at = "2024-01-01T00:00:00.000Z";
    const taskEvent = {
      event_id: "ev-task",
      event_type: Contracts.TASK_EVENT_TYPES.TaskCreated,
      payload: {
        task_id: "t-1",
        title: "Task",
        bucket: "today",
        status: "open",
        conversion: {
          from_source_type: "email",
          from_source_ref: "email:1",
          conversion_method: "user_action",
          converted_at: occurred_at,
        },
      } satisfies Contracts.TaskCreatedPayload,
      occurred_at,
      ingested_at: occurred_at,
      correlation_id: "corr-1",
      actor: { actor_id: "system", actor_type: "service" },
      envelope_version: 1,
      payload_schema_version: 1,
    };

    const noteEvent = {
      event_id: "ev-note",
      event_type: Contracts.NOTE_EVENT_TYPES.NoteCreated,
      payload: {
        note_id: "n-1",
        title: "Note",
        body_md: "body",
        content_hash: Identity.hashCanonical("body"),
        conversion: {
          from_source_type: "email",
          from_source_ref: "email:1",
          conversion_method: "user_action",
          converted_at: occurred_at,
        },
      } satisfies Contracts.NoteCreatedPayload,
      occurred_at,
      ingested_at: occurred_at,
      correlation_id: "corr-1",
      actor: { actor_id: "system", actor_type: "service" },
      envelope_version: 1,
      payload_schema_version: 1,
    };

    const events = [taskEvent, noteEvent];
    const rebuild = (evts: typeof events) => {
      let state = ConversionsProjectionDef.init();
      for (const evt of evts) {
        state = ConversionsProjectionDef.apply(
          state as ConversionsProjectionState,
          evt as Contracts.EventEnvelope,
        );
      }
      return buildConversionsProjectionFromState(
        state as ConversionsProjectionState,
      );
    };

    const first = rebuild(events);
    const second = rebuild(events);

    expect(first).toEqual(second);
  });
});
