import { NextResponse } from "next/server";
import type { BlockAction } from "@aligntrue/ui-contracts";
import {
  getPlan,
  getActionSequence,
  updateActionSequence,
  getProcessedAction,
  insertProcessedAction,
  getLatestState,
  insertState,
  pruneProcessedActions,
} from "@/lib/db";
import { deterministicId } from "@aligntrue/ops-core";

export const runtime = "nodejs";

type ActionStatus = "accepted" | "duplicate" | "rejected" | "conflict";

interface ActionRequest extends BlockAction {
  plan_id: string;
  expected_state_version: number;
  payload: { row_id?: string; [key: string]: unknown };
}

interface UIStateContent {
  selections?: Record<string, string>;
  form_values?: Record<string, unknown>;
  expanded_sections?: string[];
}

export async function POST(req: Request) {
  let body: ActionRequest;
  try {
    body = (await req.json()) as ActionRequest;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const plan = getPlan(body.plan_id);
  if (!plan) {
    return NextResponse.json({ error: "plan_not_found" }, { status: 404 });
  }
  if (plan.status === "pending_approval" || plan.status === "rejected") {
    return NextResponse.json(
      { error: "plan_not_actionable", status: plan.status },
      { status: 403 },
    );
  }

  const duplicate = getProcessedAction(
    body.plan_id,
    body.actor.actor_id,
    body.idempotency_key,
  );
  if (duplicate) {
    return NextResponse.json({
      status: "duplicate" as ActionStatus,
      state_version: duplicate.state_version,
      result: duplicate.result_json ?? null,
    });
  }

  const lastSeq = getActionSequence(body.plan_id, body.actor.actor_id);
  if (body.client_sequence <= lastSeq) {
    return NextResponse.json(
      { status: "rejected", reason: "stale_sequence", last_sequence: lastSeq },
      { status: 409 },
    );
  }

  const latestState = getLatestState(body.plan_id);
  const latestVersion = latestState?.version ?? 0;
  if (body.expected_state_version !== latestVersion) {
    return NextResponse.json(
      { status: "conflict" as ActionStatus, latest_version: latestVersion },
      { status: 409 },
    );
  }

  // UI-only mutation: handle entity_table.row_selected
  const nextContent: UIStateContent =
    (latestState?.content as UIStateContent) ?? {
      selections: {},
      form_values: {},
      expanded_sections: [],
    };

  if (
    body.action_type === "entity_table.row_selected" &&
    body.payload?.row_id
  ) {
    nextContent.selections = {
      ...(nextContent.selections ?? {}),
      selected_row: body.payload.row_id,
    };
  }

  // Placeholder for future non-READ actions -> ops-host dispatch
  const dispatched = body.action_type !== "entity_table.row_selected";

  const nextVersion = latestVersion + 1;
  const content_hash = deterministicId(JSON.stringify(nextContent));
  insertState({
    plan_id: body.plan_id,
    version: nextVersion,
    content: nextContent,
    content_hash,
  });

  updateActionSequence(body.plan_id, body.actor.actor_id, body.client_sequence);
  insertProcessedAction({
    plan_id: body.plan_id,
    actor_id: body.actor.actor_id,
    idempotency_key: body.idempotency_key,
    state_version: nextVersion,
    result_json: { selections: nextContent.selections },
    created_at: new Date().toISOString(),
  });
  pruneProcessedActions(body.plan_id, body.actor.actor_id);

  return NextResponse.json({
    status: "accepted" as ActionStatus,
    state_version: nextVersion,
    dispatched,
  });
}
