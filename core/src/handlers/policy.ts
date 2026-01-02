import { generateEventId } from "../identity/id.js";
import {
  POLICY_COMMAND_TYPES,
  POLICY_EVENT_TYPES,
  computePolicyId,
  normalizePolicyContent,
  type PolicySetPayload,
  type PolicyUpsertedPayload,
} from "../contracts/policy.js";
import type {
  CommandEnvelope,
  CommandOutcome,
  EventEnvelope,
} from "../envelopes/index.js";
import { computeScopeKey } from "../envelopes/command.js";
import type { CommandLog, EventStore } from "../storage/interfaces.js";
import {
  ActivePolicyProjectionDef,
  type ActivePolicyProjection,
} from "../projections/policy.js";
import type { CommandLogTryStartResult } from "../storage/interfaces.js";

export type PolicySetCommand = CommandEnvelope<
  (typeof POLICY_COMMAND_TYPES)["Set"],
  PolicySetPayload
>;

export async function handlePolicySetCommand(opts: {
  command: PolicySetCommand;
  eventStore: EventStore;
  commandLog: CommandLog;
  scopeKey?: string;
  startResult?: CommandLogTryStartResult;
}): Promise<CommandOutcome> {
  const { command, eventStore, commandLog } = opts;
  const scopeKey =
    opts.scopeKey ?? computeScopeKey(command.dedupe_scope, command);

  const start =
    opts.startResult ??
    (await commandLog.tryStart({
      command_id: command.command_id,
      idempotency_key: command.idempotency_key,
      dedupe_scope: command.dedupe_scope,
      scope_key: scopeKey,
    }));

  if (start.status === "duplicate") {
    return start.outcome;
  }
  if (start.status === "in_flight") {
    return {
      command_id: command.command_id,
      status: "already_processing",
      reason: "Command in flight",
    };
  }

  const { payload } = command;
  const normalizedContent = normalizePolicyContent(payload.content);

  if (payload.policy_id !== computePolicyId(normalizedContent)) {
    const rejection: CommandOutcome = {
      command_id: command.command_id,
      status: "rejected",
      reason: "policy_id_mismatch",
    };
    await commandLog.complete(command.command_id, rejection);
    return rejection;
  }

  const current = await loadActivePolicy(eventStore, payload.scope.user_id);

  if (current?.active_policy_id === payload.policy_id) {
    const outcome: CommandOutcome = {
      command_id: command.command_id,
      status: "accepted",
      completed_at: new Date().toISOString(),
      produced_events: [],
    };
    await commandLog.complete(command.command_id, outcome);
    return outcome;
  }

  if (
    payload.expected_previous_policy_id !== undefined &&
    current?.active_policy_id !== payload.expected_previous_policy_id
  ) {
    const rejection: CommandOutcome = {
      command_id: command.command_id,
      status: "rejected",
      reason: "precondition_failed",
    };
    await commandLog.complete(command.command_id, rejection);
    return rejection;
  }

  const now = new Date().toISOString();
  const event: EventEnvelope<
    (typeof POLICY_EVENT_TYPES)["Upserted"],
    PolicyUpsertedPayload
  > = {
    event_id: generateEventId({
      policy_id: payload.policy_id,
      scope: payload.scope,
      occurred_at: now,
    }),
    event_type: POLICY_EVENT_TYPES.Upserted,
    payload: {
      policy_id: payload.policy_id,
      scope: payload.scope,
      content: normalizedContent,
      previous_policy_id: current?.active_policy_id,
    },
    occurred_at: now,
    ingested_at: now,
    correlation_id: command.correlation_id,
    causation_id: command.command_id,
    causation_type: "command",
    actor: command.actor,
    envelope_version: 1,
    payload_schema_version: 1,
  };

  await eventStore.append(event);

  const outcome: CommandOutcome = {
    command_id: command.command_id,
    status: "accepted",
    produced_events: [event.event_id],
    completed_at: now,
  };

  await commandLog.complete(command.command_id, outcome);
  return outcome;
}

async function loadActivePolicy(
  eventStore: EventStore,
  userId: string,
): Promise<
  ActivePolicyProjection["by_user"] extends Map<string, infer V>
    ? V | undefined
    : never
> {
  let state = ActivePolicyProjectionDef.init();
  for await (const event of eventStore.stream()) {
    state = ActivePolicyProjectionDef.apply(state, event);
  }
  return state.by_user.get(userId);
}
