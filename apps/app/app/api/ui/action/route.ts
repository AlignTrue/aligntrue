import { NextResponse } from "next/server";
import Ajv, { type AnySchema, type ErrorObject } from "ajv";
import type { BlockAction, PlanCore } from "@aligntrue/ui-contracts";
import { getOrCreateActorId } from "@/lib/actor";
import {
  db,
  getPlan,
  getActionSequence,
  updateActionSequence,
  getProcessedAction,
  insertProcessedAction,
  getLatestState,
  insertState,
  pruneProcessedActions,
  getPendingActionRaw,
  finalizeProcessedAction,
} from "@/lib/db";
import { deterministicId } from "@aligntrue/ops-core";
import {
  createPlatformRegistry,
  ActionDispatcher,
  registerTaskHandlers,
  formSurfaceManifest,
} from "@aligntrue/ui-blocks";
import type { CommandEnvelope, CommandOutcome } from "@aligntrue/ops-core";

export const runtime = "nodejs";

type ActionStatus = "accepted" | "duplicate" | "rejected" | "conflict";

interface ActionRequest extends BlockAction {
  expected_state_version: number;
  payload: { row_id?: string; [key: string]: unknown };
}

interface UIStateContent {
  selections?: Record<string, string>;
  form_values?: Record<string, unknown>;
  expanded_sections?: string[];
}

const PENDING_TIMEOUT_MS = 60_000;
const ajv = new Ajv({ strict: true, allErrors: true });
const EMPTY_STATE: UIStateContent = {
  selections: {},
  form_values: {},
  expanded_sections: [],
};

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((e) =>
    `${e.instancePath || "/"} ${e.message ?? ""}`.trim(),
  );
}

function evaluateActionPdp(params: {
  manifestCapability?: string;
  actionSchema: { requires_approval?: boolean; required_capability?: string };
  resolvedCommandType?: string | undefined;
}): { allowed: boolean; requires_approval: boolean; reasons: string[] } {
  void params.manifestCapability;
  void params.resolvedCommandType;

  const reasons: string[] = [];

  if (params.actionSchema.requires_approval) {
    reasons.push("approval_required");
  }

  // TODO: Integrate real capability grants; currently permissive for dogfood.
  const requiresApproval = params.actionSchema.requires_approval ?? false;

  return {
    allowed: !requiresApproval,
    requires_approval: requiresApproval,
    reasons,
  };
}

async function dispatchCommand(
  envelope: CommandEnvelope,
): Promise<CommandOutcome> {
  // TODO: integrate ops-host dispatch; for now return accepted stub
  return { status: "accepted", command_id: envelope.command_id };
}

export async function POST(req: Request) {
  let body: ActionRequest;
  try {
    body = (await req.json()) as ActionRequest;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Server-authoritative actor
  const actor = await getOrCreateActorId();
  const action: ActionRequest = { ...body, actor };

  const plan = getPlan(action.plan_id);
  if (!plan) {
    return NextResponse.json({ error: "plan_not_found" }, { status: 404 });
  }
  if (plan.status === "pending_approval" || plan.status === "rejected") {
    return NextResponse.json(
      { error: "plan_not_actionable", status: plan.status },
      { status: 403 },
    );
  }

  const planCore = plan.core as PlanCore;
  const blockInstance = planCore.blocks.find(
    (b) => b.block_instance_id === action.block_instance_id,
  );
  if (!blockInstance) {
    return NextResponse.json(
      { error: "block_instance_not_in_plan" },
      { status: 400 },
    );
  }
  if (blockInstance.block_type !== action.block_type) {
    return NextResponse.json({ error: "block_type_mismatch" }, { status: 400 });
  }

  const platformRegistry = createPlatformRegistry();
  const manifest = platformRegistry.getManifest(action.block_type);
  if (!manifest) {
    return NextResponse.json({ error: "manifest_not_found" }, { status: 400 });
  }
  if (blockInstance.manifest_hash !== manifest.manifest_hash) {
    return NextResponse.json(
      { error: "plan_stale_manifest", message: "Regenerate plan" },
      { status: 409 },
    );
  }

  const actionSchema = platformRegistry.getActionSchema(
    action.block_type,
    action.action_type,
  );
  if (!actionSchema) {
    return NextResponse.json(
      { error: "action_not_in_manifest" },
      { status: 400 },
    );
  }

  const validatePayload = ajv.compile(
    actionSchema.schema.payload_schema as AnySchema,
  );
  const payloadValid = validatePayload(action.payload);
  if (!payloadValid) {
    return NextResponse.json(
      {
        error: "invalid_payload",
        details: formatAjvErrors(validatePayload.errors),
      },
      { status: 400 },
    );
  }

  if (action.action_type === "form.submitted") {
    const payload = action.payload as {
      form_id?: string;
      command_type?: string;
    };
    const formProps = blockInstance.props as {
      form_id?: string;
      submit?: { allowed_command_types?: string[] };
    };
    if (!payload.form_id || payload.form_id !== formProps.form_id) {
      return NextResponse.json({ error: "form_id_mismatch" }, { status: 400 });
    }
    if (
      !formProps.submit?.allowed_command_types?.includes(
        payload.command_type ?? "",
      )
    ) {
      return NextResponse.json(
        { error: "command_type_not_allowed" },
        { status: 403 },
      );
    }
  }

  const resolvedCommandType =
    action.action_type === "form.submitted"
      ? (action.payload as { command_type?: string }).command_type
      : undefined;
  const pdpDecision = evaluateActionPdp({
    manifestCapability: manifest.required_capability,
    actionSchema: actionSchema.schema,
    resolvedCommandType,
  });
  if (!pdpDecision.allowed) {
    return NextResponse.json(
      { error: "pdp_blocked", reasons: pdpDecision.reasons },
      { status: 403 },
    );
  }
  if (pdpDecision.requires_approval) {
    return NextResponse.json(
      { error: "approval_required", reasons: pdpDecision.reasons },
      { status: 403 },
    );
  }

  // Idempotency duplicate check (before txn)
  const duplicate = getProcessedAction(
    action.plan_id,
    action.actor.actor_id,
    action.idempotency_key,
  );
  if (duplicate && duplicate.status === "completed") {
    return NextResponse.json({
      status: "duplicate" as ActionStatus,
      state_version: duplicate.state_version,
      result: duplicate.result_json ?? null,
    });
  }

  const txResult = db.transaction(() => {
    const pending = getPendingActionRaw(action.plan_id, action.actor.actor_id);
    if (pending) {
      const age = Date.now() - new Date(pending.created_at).getTime();
      if (age > PENDING_TIMEOUT_MS) {
        finalizeProcessedAction(
          action.plan_id,
          action.actor.actor_id,
          pending.idempotency_key,
          {
            status: "failed",
            errors_json: ["pending_timeout"],
          },
        );
      } else {
        return { error: "action_in_flight" };
      }
    }

    const latestState = getLatestState(action.plan_id);
    const latestVersion = latestState?.version ?? 0;
    if (action.expected_state_version !== latestVersion) {
      return { error: "state_version_conflict", latest_version: latestVersion };
    }

    const existing = getProcessedAction(
      action.plan_id,
      action.actor.actor_id,
      action.idempotency_key,
    );
    if (existing && existing.status === "completed") {
      return { duplicate: true, state_version: existing.state_version };
    }

    const lastSeq = getActionSequence(action.plan_id, action.actor.actor_id);
    if (action.client_sequence <= lastSeq) {
      return { error: "stale_sequence", last_sequence: lastSeq };
    }

    updateActionSequence(
      action.plan_id,
      action.actor.actor_id,
      action.client_sequence,
    );

    const createdAt = new Date().toISOString();

    insertProcessedAction({
      plan_id: action.plan_id,
      actor_id: action.actor.actor_id,
      idempotency_key: action.idempotency_key,
      action_id: action.action_id,
      status: "pending",
      state_version: null,
      result_json: {
        action_type: action.action_type,
        command_type: resolvedCommandType,
      },
      created_at: createdAt,
    });

    const baseContent: UIStateContent =
      (latestState?.content as UIStateContent) ?? { ...EMPTY_STATE };

    return { reserved: true, latestVersion, baseContent };
  })();

  if ("error" in txResult && txResult.error) {
    const status = txResult.error === "action_in_flight" ? 429 : 409;
    return NextResponse.json(txResult, { status });
  }
  if ("duplicate" in txResult && txResult.duplicate) {
    return NextResponse.json({
      status: "duplicate" as ActionStatus,
      state_version: txResult.state_version ?? null,
    });
  }

  if (!("reserved" in txResult) || !txResult.reserved) {
    return NextResponse.json({ error: "reservation_failed" }, { status: 500 });
  }

  // UI-only mutation: handle entity_table.row_selected
  const baseContent = {
    selections: { ...(txResult.baseContent?.selections ?? {}) },
    form_values: { ...(txResult.baseContent?.form_values ?? {}) },
    expanded_sections: [...(txResult.baseContent?.expanded_sections ?? [])],
  };
  const nextContent: UIStateContent = baseContent;

  let uiMutated = false;
  if (
    action.action_type === "entity_table.row_selected" &&
    (action.payload as { row_id?: string })?.row_id
  ) {
    const rowId = (action.payload as { row_id?: string }).row_id!;
    nextContent.selections = {
      ...(nextContent.selections ?? {}),
      selected_row: rowId,
    };
    uiMutated = true;
  }

  if (!uiMutated) {
    const dispatcher = new ActionDispatcher();
    registerTaskHandlers(dispatcher, formSurfaceManifest, dispatchCommand);
    const dispatchResult = await dispatcher.dispatch(action);
    if (!dispatchResult.ok) {
      finalizeProcessedAction(
        action.plan_id,
        action.actor.actor_id,
        action.idempotency_key,
        {
          status: "failed",
          errors_json: dispatchResult.errors,
        },
      );
      return NextResponse.json(
        { error: "dispatch_failed", errors: dispatchResult.errors },
        { status: 500 },
      );
    }
  }

  const nextVersion = txResult.latestVersion + 1;
  const content_hash = deterministicId(nextContent);
  insertState({
    plan_id: action.plan_id,
    version: nextVersion,
    content: nextContent,
    content_hash,
  });

  finalizeProcessedAction(
    action.plan_id,
    action.actor.actor_id,
    action.idempotency_key,
    {
      status: "completed",
      state_version: nextVersion,
      result_json: { selections: nextContent.selections },
    },
  );
  pruneProcessedActions(action.plan_id, action.actor.actor_id);

  return NextResponse.json({
    status: "accepted" as ActionStatus,
    state_version: nextVersion,
    dispatched: false,
  });
}
