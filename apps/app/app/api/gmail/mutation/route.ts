import { NextResponse } from "next/server";
import {
  GmailMutations,
  Storage,
  OPS_GMAIL_MUTATIONS_ENABLED,
  Identity,
} from "@aligntrue/ops-core";
import * as GmailApi from "../../../../lib/gmail-api.js";

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

  const eventStore = new Storage.JsonlEventStore();
  const executor = new GmailMutations.GmailMutationExecutor(eventStore, {
    now: () => new Date().toISOString(),
    flagEnabled: OPS_GMAIL_MUTATIONS_ENABLED,
    performer: {
      perform: async (op, input) => {
        if (op === "APPLY_LABEL") {
          if (!body.label_id || typeof body.label_id !== "string") {
            throw new Error("label_id is required for APPLY_LABEL");
          }
          await GmailApi.applyLabel(input.message_id, body.label_id);
          return { destination_ref: `label:${body.label_id}` };
        }
        if (op === "ARCHIVE") {
          await GmailApi.archive(input.thread_id);
          return { destination_ref: `thread:${input.thread_id}` };
        }
        throw new Error(`Unsupported operation: ${op}`);
      },
    },
  });

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
