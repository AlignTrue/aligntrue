import { NextResponse } from "next/server";
import { Identity } from "@aligntrue/ops-core";
import { getGmailMutationExecutor } from "@/lib/ops-services";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.message_id !== "string" ||
    typeof body.thread_id !== "string" ||
    !Array.isArray(body.operations)
  ) {
    return NextResponse.json(
      { error: "message_id, thread_id, and operations are required" },
      { status: 400 },
    );
  }

  const mutation_id =
    typeof body.mutation_id === "string"
      ? body.mutation_id
      : Identity.randomId();
  const operations = body.operations as GmailMutations.GmailMutationOp[];

  const executor = getGmailMutationExecutor();

  try {
    const result = await executor.execute({
      mutation_id,
      provider: "google_gmail",
      message_id: body.message_id,
      thread_id: body.thread_id,
      operations,
      ...(body.label_id ? { label_id: body.label_id } : {}),
    });

    return NextResponse.json({
      receipts: result.receipts,
      disabled: result.disabled,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Mutation failed" },
      { status: 400 },
    );
  }
}
