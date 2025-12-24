import { NextResponse } from "next/server";
import {
  OPS_GMAIL_SEND_ENABLED,
  Connectors,
  OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED,
} from "@aligntrue/ops-core";

const FROM_ADDRESS =
  process.env["GMAIL_FROM_ADDRESS"] ?? process.env["GMAIL_MUTATION_FROM"];
const ACCESS_TOKEN =
  process.env["GMAIL_SEND_ACCESS_TOKEN"] ??
  process.env["GMAIL_MUTATION_ACCESS_TOKEN"];

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (!OPS_GMAIL_SEND_ENABLED || !OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED) {
    return NextResponse.json(
      { error: "Gmail send is disabled" },
      { status: 403 },
    );
  }
  if (!FROM_ADDRESS || !ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "Gmail send credentials are not configured" },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    to?: string;
    subject?: string;
    message?: string;
    inReplyTo?: string;
    references?: string[];
  };

  if (!body.to || !body.subject || !body.message) {
    return NextResponse.json(
      { error: "to, subject, and message are required" },
      { status: 400 },
    );
  }

  const idempotencyKey =
    request.headers.get("x-idempotency-key") ?? crypto.randomUUID().slice(0, 8);

  const result = await Connectors.GoogleGmail.sendPlainTextReply({
    accessToken: ACCESS_TOKEN,
    from: FROM_ADDRESS,
    to: body.to,
    subject: body.subject,
    body: body.message,
    inReplyTo: body.inReplyTo,
    references: body.references,
    idempotencyKey,
  });

  return NextResponse.json({
    conversation_id: params.id,
    message_id: result.id,
    thread_id: result.threadId,
  });
}
