import { NextRequest, NextResponse } from "next/server";
import { getConversionService, getHost } from "@/lib/ops-services";
import { Storage } from "@aligntrue/ops-host";

const ACTOR = {
  actor_id: "web-user",
  actor_type: "human",
  display_name: "Web User",
} as const;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const host = await getHost();
  const service = getConversionService(
    host.eventStore as Storage.JsonlEventStore,
    host.commandLog as Storage.JsonlCommandLog,
  );
  try {
    const result = await service.convertEmailToTask({
      source_ref: id,
      actor: ACTOR,
    });

    return NextResponse.json({
      task_id: result.created_id,
      source_ref: result.source_ref,
      outcome: result.outcome,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Task conversion failed" },
      { status: 500 },
    );
  }
}
