import { NextResponse } from "next/server";
import { Identity } from "@aligntrue/ops-core";
import { TASK_COMMAND_TYPES } from "@aligntrue/ops-core/contracts/tasks.js";
import { getHost } from "@/lib/ops-services";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, bucket = "today", request_id } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const host = await getHost();
    const task_id = Identity.randomId();
    const idempotency_key =
      request_id ??
      Identity.deterministicId({
        actor: "web-user",
        title,
        bucket,
      });
    const correlation_id = Identity.randomId();

    const command = {
      command_id: Identity.randomId(),
      idempotency_key,
      dedupe_scope: "target",
      command_type: TASK_COMMAND_TYPES.Create,
      payload: {
        task_id,
        title: title.trim(),
        bucket,
        status: "open",
      },
      target_ref: `task:${task_id}`,
      actor: {
        actor_id: "web-user",
        actor_type: "human" as const,
      },
      requested_at: new Date().toISOString(),
      correlation_id,
    };

    const outcome = await host.runtime.dispatchCommand(command);

    if (outcome.status === "rejected") {
      return NextResponse.json(
        { error: outcome.reason ?? "Rejected" },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: outcome.status === "accepted",
      task_id,
      idempotent: outcome.status === "already_processed",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create task" },
      { status: 500 },
    );
  }
}
