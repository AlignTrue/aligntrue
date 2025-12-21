import { NextResponse } from "next/server";
import { Convert, Storage } from "@aligntrue/ops-core";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.message_id !== "string") {
    return NextResponse.json(
      { error: "message_id is required" },
      { status: 400 },
    );
  }

  const eventStore = new Storage.JsonlEventStore();
  const commandLog = new Storage.JsonlCommandLog();
  const conversion = new Convert.ConversionService(eventStore, commandLog);

  try {
    const result = await conversion.convertEmailToTask({
      message_id: body.message_id,
      title: typeof body.title === "string" ? body.title : undefined,
      actor: { actor_id: "web-user", actor_type: "human" },
      conversion_method: body.conversion_method ?? "user_action",
    });

    return NextResponse.json({
      task_id: result.created_id,
      source_ref: result.source_ref,
      status: result.outcome.status,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to convert email" },
      { status: 400 },
    );
  }
}
