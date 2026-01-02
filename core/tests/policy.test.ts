import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  Storage,
  Contracts,
  Identity,
  handlePolicySetCommand,
  Projections,
} from "../src/index.js";

const ACTOR = { actor_id: "user-1", actor_type: "human" } as const;
const NOW = "2024-01-01T00:00:00Z";

function buildPolicyCommand(input: {
  policy_id: string;
  content: Contracts.PolicyContent;
  user_id?: string;
  expected_previous_policy_id?: string;
  command_id?: string;
  idempotency_key?: string;
}) {
  const user_id = input.user_id ?? "user-1";
  const command_id =
    input.command_id ?? Identity.deterministicId(input.policy_id);
  const idempotency_key =
    input.idempotency_key ??
    `policy:${user_id}:${input.policy_id}:${command_id}`;
  return {
    command_id,
    idempotency_key,
    command_type: Contracts.POLICY_COMMAND_TYPES.Set,
    payload: {
      policy_id: input.policy_id,
      scope: { user_id },
      content: input.content,
      expected_previous_policy_id: input.expected_previous_policy_id,
    },
    target_ref: input.policy_id,
    dedupe_scope: `policy.set:${user_id}`,
    correlation_id: command_id,
    actor: ACTOR,
    requested_at: NOW,
    capability_id: Contracts.POLICY_COMMAND_TYPES.Set,
  } satisfies Contracts.CommandEnvelope<
    (typeof Contracts.POLICY_COMMAND_TYPES)["Set"],
    Contracts.PolicySetPayload
  >;
}

describe("policy contracts + handler", () => {
  let dir: string;
  let eventsPath: string;
  let commandsPath: string;
  let outcomesPath: string;
  let eventStore: Storage.JsonlEventStore;
  let commandLog: Storage.JsonlCommandLog;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "ops-core-policy-"));
    eventsPath = join(dir, "events.jsonl");
    commandsPath = join(dir, "commands.jsonl");
    outcomesPath = join(dir, "outcomes.jsonl");
    eventStore = new Storage.JsonlEventStore(eventsPath, {
      allowExternalPaths: true,
    });
    commandLog = new Storage.JsonlCommandLog(commandsPath, outcomesPath, {
      allowExternalPaths: true,
    });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("computePolicyId is stable across key/array order", () => {
    const a = Contracts.computePolicyId({
      surfaces_by_intent: { dashboard: ["tasks_list", "notes_list"] },
    });
    const b = Contracts.computePolicyId({
      surfaces_by_intent: { dashboard: ["notes_list", "tasks_list"] },
    });
    expect(a).toBe(b);
  });

  it("policy.set is no-op when already active", async () => {
    const content = {
      surfaces_by_intent: { dashboard: ["tasks_list"] },
    };
    const policy_id = Contracts.computePolicyId(content);

    const cmd1 = buildPolicyCommand({ policy_id, content });
    const first = await handlePolicySetCommand({
      command: cmd1,
      eventStore,
      commandLog,
    });
    expect(first.status).toBe("accepted");
    expect(first.produced_events?.length).toBe(1);

    const cmd2 = buildPolicyCommand({
      policy_id,
      content,
      command_id: "second",
      idempotency_key: "second",
    });
    const second = await handlePolicySetCommand({
      command: cmd2,
      eventStore,
      commandLog,
    });
    expect(second.status).toBe("accepted");
    expect(second.produced_events?.length ?? 0).toBe(0);

    const events = await collectEvents(eventStore);
    expect(events.length).toBe(1);
  });

  it("policy.set rejects on precondition mismatch", async () => {
    const contentA = { surfaces_by_intent: { dashboard: ["tasks_list"] } };
    const contentB = { surfaces_by_intent: { dashboard: ["notes_list"] } };
    const policyA = Contracts.computePolicyId(contentA);
    const policyB = Contracts.computePolicyId(contentB);

    await handlePolicySetCommand({
      command: buildPolicyCommand({ policy_id: policyA, content: contentA }),
      eventStore,
      commandLog,
    });

    const result = await handlePolicySetCommand({
      command: buildPolicyCommand({
        policy_id: policyB,
        content: contentB,
        expected_previous_policy_id: "wrong",
        command_id: "second",
        idempotency_key: "second",
      }),
      eventStore,
      commandLog,
    });

    expect(result.status).toBe("rejected");
    expect(result.reason).toBe("precondition_failed");

    const events = await collectEvents(eventStore);
    expect(events.length).toBe(1);
  });

  it("projection rebuild matches after replay", async () => {
    const content = { surfaces_by_intent: { dashboard: ["tasks_list"] } };
    const policy_id = Contracts.computePolicyId(content);

    await handlePolicySetCommand({
      command: buildPolicyCommand({ policy_id, content }),
      eventStore,
      commandLog,
    });

    const rebuilt = await Projections.rebuildOne(
      Projections.ActivePolicyProjectionDef,
      eventStore,
    );

    const state = Projections.buildActivePolicyProjectionFromState(
      rebuilt.data,
    );
    expect(state.by_user.get("user-1")?.active_policy_id).toBe(policy_id);
  });
});

async function collectEvents(store: Storage.JsonlEventStore) {
  const events: unknown[] = [];
  for await (const event of store.stream()) {
    events.push(event);
  }
  return events;
}
