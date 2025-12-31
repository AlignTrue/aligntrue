import { describe, it, expect, vi, beforeAll } from "vitest";
let Identity: typeof import("@aligntrue/ops-core").Identity;
let Feedback: typeof import("@aligntrue/ops-core").Feedback;
let Contracts: typeof import("@aligntrue/ops-core").Contracts;
type CommandEnvelope = import("@aligntrue/ops-core").CommandEnvelope;
type PackContext = import("@aligntrue/ops-core").PackContext;
let commandHandlers:
  | typeof import("../src/index.js").commandHandlers
  | undefined;
let packModule:
  | (typeof import("../src/index.js").default & {
      extendContext?: (
        base: PackContext,
        opts?: { packId: string },
      ) => PackContext;
    })
  | undefined;
let InboxProjectionDef:
  | typeof import("../src/projection.js").InboxProjectionDef
  | undefined;
let buildInboxProjectionFromState:
  | typeof import("../src/projection.js").buildInboxProjectionFromState
  | undefined;
async function loadModule() {
  process.env["OPS_SUGGESTIONS_ENABLED"] = "1";
  const core = await import("@aligntrue/ops-core");
  Identity = core.Identity;
  Feedback = core.Feedback;
  Contracts = core.Contracts;
  const mod = await import("../src/index.js");
  commandHandlers = mod.commandHandlers;
  packModule = mod.default as typeof packModule;
  InboxProjectionDef = mod.InboxProjectionDef;
  buildInboxProjectionFromState = mod.buildInboxProjectionFromState;
}

process.env["OPS_SUGGESTIONS_ENABLED"] = "1";

function makeApproveCommand(): CommandEnvelope<
  (typeof Contracts.SUGGESTION_COMMAND_TYPES)["Approve"],
  Contracts.ApproveSuggestionPayload & { expected_hash: string }
> {
  const command_id = Identity.randomId();
  const requested_at = new Date().toISOString();
  return {
    command_id,
    idempotency_key: command_id,
    command_type: Contracts.SUGGESTION_COMMAND_TYPES.Approve,
    payload: {
      suggestion_id: "s-1",
      expected_hash: "h1",
    },
    target_ref: "suggestion:s-1",
    dedupe_scope: "target",
    actor: { actor_id: "tester", actor_type: "human" },
    correlation_id: command_id,
    requested_at,
    capability_id: Contracts.SUGGESTION_COMMAND_TYPES.Approve,
  };
}

function makeGeneratedEvent() {
  const occurred_at = new Date().toISOString();
  return {
    event_id: "ev-gen-1",
    event_type: Contracts.SUGGESTION_EVENT_TYPES.Generated,
    payload: {
      suggestion_id: "s-1",
      suggestion_type: "task_triage",
      target_refs: ["task:t1"],
    },
    occurred_at,
    ingested_at: occurred_at,
    correlation_id: "corr-1",
    actor: { actor_id: "system", actor_type: "service" },
    envelope_version: 1,
    payload_schema_version: 1,
  } satisfies Contracts.EventEnvelope;
}

function makeFeedbackEvent(
  kind: (typeof Feedback.FEEDBACK_TYPES)[keyof typeof Feedback.FEEDBACK_TYPES],
) {
  const occurred_at = new Date().toISOString();
  return {
    event_id: `ev-${kind}`,
    event_type: kind,
    payload: {
      artifact_id: "s-1",
      feedback_type: kind,
    },
    occurred_at,
    ingested_at: occurred_at,
    correlation_id: "corr-1",
    actor: { actor_id: "system", actor_type: "service" },
    envelope_version: 1,
    payload_schema_version: 1,
  } satisfies Feedback.FeedbackEvent;
}

describe("pack-suggestions command handlers", () => {
  beforeAll(async () => {
    await loadModule();
  });

  function makeContext(overrides: Partial<PackContext> = {}): PackContext {
    const noop = async () => {};
    const asyncEmpty = async function* () {};
    const projectionRegistry: PackContext["projectionRegistry"] = {
      register: () => {},
      unregister: () => {},
    };
    return {
      eventStore: {
        append: noop,
        stream: asyncEmpty,
        getById: async () => null,
      },
      commandLog: {
        record: noop,
        recordOutcome: noop,
        getByIdempotencyKey: async () => null,
        tryStart: async () => ({ status: "new" as const }),
        complete: noop,
      },
      projectionRegistry,
      config: {},
      dispatchChild: async () => {
        throw new Error("dispatchChild stub not set");
      },
      ...overrides,
    };
  }

  it("reuses the same stores across context invocations", () => {
    if (!packModule || !packModule.extendContext) {
      throw new Error("pack module not loaded");
    }
    const base = makeContext();
    const first = packModule.extendContext(base, { packId: "suggestions" });
    const second = packModule.extendContext(base, { packId: "suggestions" });

    expect(first.artifactStore).toBe(second.artifactStore);
    expect(first.feedbackEventStore).toBe(second.feedbackEventStore);
    expect(first.suggestionEventStore).toBe(second.suggestionEventStore);
  });

  it("approve returns CommandOutcome with child command ids", async () => {
    const feedbackEvents: Feedback.FeedbackEvent[] = [];
    const suggestionArtifact = {
      artifact_id: "s-1",
      created_at: new Date().toISOString(),
      output_type: `suggestion:task_triage`,
      output_data: {
        suggestion_type: "task_triage",
        target_refs: ["task:t1"],
        diff: {
          type: "task_triage",
          task_id: "t1",
          from_bucket: "later",
          to_bucket: "today",
          reason: "test",
        },
        rationale: "test",
      },
      content_hash: "h1",
    };

    const command = makeApproveCommand();

    const artifactStore = {
      getDerivedById: async (id: string) =>
        id === "s-1" ? suggestionArtifact : null,
    };
    const feedbackEventStore = {
      events: feedbackEvents,
      async append(evt: Feedback.FeedbackEvent) {
        this.events.push(evt);
      },
      async *stream() {
        for (const evt of this.events) yield evt;
      },
    };
    const suggestionEventStore = {
      async append() {},
      async *stream() {},
    };

    const dispatchChild = vi.fn().mockResolvedValue({
      command_id: "child-1",
      status: "accepted",
      produced_events: ["ev-child"],
      child_commands: [],
    } satisfies Contracts.CommandOutcome);

    const outcome = await commandHandlers[
      Contracts.SUGGESTION_COMMAND_TYPES.Approve
    ](command, {
      ...makeContext({
        artifactStore,
        feedbackEventStore,
        suggestionEventStore,
        dispatchChild,
      }),
    });

    expect(outcome.command_id).toBe(command.command_id);
    expect(outcome.status).toBe("accepted");
    expect(dispatchChild).toHaveBeenCalled();
  });

  it("duplicate approve returns already_processed", async () => {
    const suggestionArtifact = {
      artifact_id: "s-1",
      created_at: new Date().toISOString(),
      output_type: `suggestion:task_triage`,
      output_data: {
        suggestion_type: "task_triage",
        target_refs: ["task:t1"],
        diff: {
          type: "task_triage",
          task_id: "t1",
          from_bucket: "later",
          to_bucket: "today",
          reason: "test",
        },
        rationale: "test",
      },
      content_hash: "h1",
    };

    const command = makeApproveCommand();

    const feedbackEvents: Feedback.FeedbackEvent[] = [];
    const artifactStore = {
      getDerivedById: async () => suggestionArtifact,
    };
    const feedbackEventStore = {
      events: feedbackEvents,
      async append(evt: Feedback.FeedbackEvent) {
        this.events.push(evt);
      },
      async *stream() {
        for (const evt of this.events) yield evt;
      },
    };
    const suggestionEventStore = {
      async append() {},
      async *stream() {},
    };

    const dispatchChild = vi.fn().mockResolvedValue({
      command_id: "child-1",
      status: "accepted",
      produced_events: ["ev-child"],
    } satisfies Contracts.CommandOutcome);

    // First approval
    const first = await commandHandlers[
      Contracts.SUGGESTION_COMMAND_TYPES.Approve
    ](command, {
      ...makeContext({
        artifactStore,
        feedbackEventStore,
        suggestionEventStore,
        dispatchChild,
      }),
    });
    expect(first.status).toBe("accepted");

    // Second approval should see feedback and return already_processed
    const second = await commandHandlers[
      Contracts.SUGGESTION_COMMAND_TYPES.Approve
    ](command, {
      ...makeContext({
        artifactStore,
        feedbackEventStore,
        suggestionEventStore,
        dispatchChild,
      }),
    });
    expect(second.status).toBe("already_processed");
  });
});

describe("pack-suggestions projections", () => {
  beforeAll(async () => {
    if (!InboxProjectionDef) {
      await loadModule();
    }
  });
  it("rebuilds inbox deterministically", () => {
    const generated = makeGeneratedEvent();
    const accepted = makeFeedbackEvent(Feedback.FEEDBACK_TYPES.Accepted);
    const events = [generated, accepted];

    const rebuild = () => {
      let state = InboxProjectionDef.init();
      for (const evt of events) {
        state = InboxProjectionDef.apply(state, evt);
      }
      return buildInboxProjectionFromState(state);
    };

    const first = rebuild();
    const second = rebuild();

    expect(first).toEqual(second);
  });
});
