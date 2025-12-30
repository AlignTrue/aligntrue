import { NextRequest, NextResponse } from "next/server";
import { dispatchConvertCommand } from "@/lib/ops-services";
import { Identity } from "@aligntrue/ops-core";

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
  try {
    const { outcome } = await dispatchConvertCommand("task", id, ACTOR);

    // Calculate deterministic task_id to match expected response format
    const task_id = Identity.deterministicId({ source_ref: id, op: "to_task" });

    return NextResponse.json({
      task_id,
      source_ref: id,
      outcome,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Task conversion failed" },
      { status: 500 },
    );
  }
}
