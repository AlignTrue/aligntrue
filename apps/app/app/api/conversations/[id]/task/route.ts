import { NextResponse } from "next/server";
import { getConversionService } from "@/lib/ops-services";

const ACTOR = {
  actor_id: "web-user",
  actor_type: "human",
  display_name: "Web User",
} as const;

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const service = getConversionService();
  const result = await service.convertEmailToTask({
    source_ref: params.id,
    actor: ACTOR,
  });

  return NextResponse.json({
    task_id: result.created_id,
    source_ref: result.source_ref,
    outcome: result.outcome,
  });
}
