import { NextResponse } from "next/server";
import { getConversionService, getHost } from "@/lib/ops-services";
import { Storage } from "@aligntrue/ops-host";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.message_id !== "string") {
    return NextResponse.json(
      { error: "message_id is required" },
      { status: 400 },
    );
  }

  const host = await getHost();
  const conversion = getConversionService(
    host.eventStore as Storage.JsonlEventStore,
    host.commandLog as Storage.JsonlCommandLog,
  );

  try {
    const result = await conversion.convertEmailToNote({
      message_id: body.message_id,
      title: typeof body.title === "string" ? body.title : undefined,
      body_md: typeof body.body_md === "string" ? body.body_md : undefined,
      actor: { actor_id: "web-user", actor_type: "human" },
      conversion_method: body.conversion_method ?? "user_action",
    });

    return NextResponse.json({
      note_id: result.created_id,
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
