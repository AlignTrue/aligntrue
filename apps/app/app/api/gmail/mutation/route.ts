import { NextResponse } from "next/server";
import { Identity, Storage } from "@aligntrue/ops-core";
import { Mutations as GmailMutations } from "@aligntrue/ops-shared-google-gmail";
import { getGmailMutationExecutor, getHost } from "@/lib/ops-services";

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

  const operationsAreValid =
    Array.isArray(body.operations) &&
    body.operations.every(
      (op: unknown): op is GmailMutations.GmailMutationOp =>
        op === "APPLY_LABEL" || op === "ARCHIVE",
    );
  if (!operationsAreValid) {
    return NextResponse.json(
      { error: "operations must be APPLY_LABEL or ARCHIVE" },
      { status: 400 },
    );
  }
  const operations = body.operations;

  if (body.label_id !== undefined && typeof body.label_id !== "string") {
    return NextResponse.json(
      { error: "label_id must be a string when provided" },
      { status: 400 },
    );
  }
  const label_id =
    typeof body.label_id === "string" ? body.label_id : undefined;

  const host = await getHost();
  const executor = getGmailMutationExecutor(
    host.eventStore as Storage.JsonlEventStore,
  );

  try {
    const result = await executor.execute({
      mutation_id,
      provider: "google_gmail",
      message_id: body.message_id,
      thread_id: body.thread_id,
      operations,
      ...(label_id ? { label_id } : {}),
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
