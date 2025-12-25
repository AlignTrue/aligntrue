import { NextResponse } from "next/server";
import { OPS_TASKS_ENABLED, Identity, Tasks } from "@aligntrue/ops-core";

export async function POST(request: Request) {
  if (!OPS_TASKS_ENABLED) {
    return NextResponse.json({ error: "Tasks disabled" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { title, bucket = "today" } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const task_id = Identity.deterministicId(title);
    const command_type = "task.create";
    const payload = {
      task_id,
      title: title.trim(),
      bucket,
      status: "open",
    } as Tasks.TaskCommandPayload;

    const command: Tasks.TaskCommandEnvelope = {
      command_id: Identity.generateCommandId({ command_type, payload }),
      command_type,
      payload,
      target_ref: `task:${task_id}`,
      dedupe_scope: `task:${task_id}`,
      correlation_id: Identity.randomId(),
      actor: {
        actor_id: "web-user",
        actor_type: "human",
      },
      requested_at: new Date().toISOString(),
    };

    const ledger = Tasks.createJsonlTaskLedger();
    await ledger.execute(command);

    return NextResponse.json({
      success: true,
      task_id,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create task" },
      { status: 500 },
    );
  }
}
