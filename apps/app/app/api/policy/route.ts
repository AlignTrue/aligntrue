import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  Contracts,
  Projections,
  handlePolicySetCommand,
} from "@aligntrue/core";
import { getHost, getEventStore, getCommandLog } from "@/lib/ops-services";
import { getOrCreateActorId } from "@/lib/actor";

export const runtime = "nodejs";

export async function GET() {
  await getHost();
  const eventStore = getEventStore();
  const rebuilt = await Projections.rebuildOne(
    Projections.ActivePolicyProjectionDef,
    eventStore,
  );
  const state = Projections.buildActivePolicyProjectionFromState(rebuilt.data);

  const actor = await getOrCreateActorId();
  const active = state.by_user.get(actor.actor_id);

  return NextResponse.json({
    policy_id: active?.active_policy_id ?? null,
    surfaces_by_intent: active?.surfaces_by_intent ?? {},
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    content: Contracts.PolicyContent;
    expected_previous_policy_id?: string;
  };

  await getHost();
  const eventStore = getEventStore();
  const commandLog = getCommandLog();
  const actor = await getOrCreateActorId();

  const normalized = Contracts.normalizePolicyContent(body.content);
  const policy_id = Contracts.computePolicyId(normalized);
  const now = new Date().toISOString();
  const command_id = randomUUID();

  const command: Contracts.CommandEnvelope<
    (typeof Contracts.POLICY_COMMAND_TYPES)["Set"],
    Contracts.PolicySetPayload
  > = {
    command_id,
    idempotency_key: `policy:${actor.actor_id}:${policy_id}`,
    command_type: Contracts.POLICY_COMMAND_TYPES.Set,
    payload: {
      policy_id,
      scope: { user_id: actor.actor_id },
      content: body.content,
      expected_previous_policy_id: body.expected_previous_policy_id,
    },
    target_ref: policy_id,
    dedupe_scope: `policy.set:${actor.actor_id}`,
    correlation_id: command_id,
    actor,
    requested_at: now,
    capability_id: Contracts.POLICY_COMMAND_TYPES.Set,
  };

  const outcome = await handlePolicySetCommand({
    command,
    eventStore,
    commandLog,
  });

  return NextResponse.json({
    policy_id,
    active_policy_id: outcome.status === "accepted" ? policy_id : null,
    outcome,
  });
}
