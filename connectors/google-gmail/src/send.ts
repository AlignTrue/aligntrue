import { createHash } from "crypto";
import {
  GoogleApiError,
  TokenExpiredError,
} from "@aligntrue/connector-google-common";
import {
  evaluateEgress,
  type EgressEnvelope,
  type EgressReceipt,
} from "@aligntrue/core";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface SendGmailMessageInput {
  accessToken: string;
  raw: string; // base64url encoded RFC822 message
  idempotencyKey?: string;
  correlationId?: string;
}

export interface SendGmailReplyInput {
  accessToken: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string[];
  idempotencyKey?: string;
}

export interface SendGmailResult {
  id: string;
  threadId?: string;
  receipt?: EgressReceipt;
}

class EgressDeniedError extends Error {
  constructor(
    public readonly reason: string,
    public readonly receipt: EgressReceipt | undefined,
  ) {
    super(`Egress denied: ${reason}`);
  }
}

function computeIdempotencyKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Send a prepared RFC822 email (base64url encoded) to Gmail.
 */
export async function sendGmailMessage(
  input: SendGmailMessageInput,
): Promise<SendGmailResult> {
  const url = `${GMAIL_BASE}/messages/send`;
  const idempotencyKey =
    input.idempotencyKey ?? computeIdempotencyKey(input.raw);

  const envelope: EgressEnvelope = {
    destination: "gmail.send",
    idempotencyKey,
    classification: "external_side_effect",
    correlationId: input.correlationId ?? idempotencyKey,
  };

  const decision = await evaluateEgress({
    envelope,
    allowMissingModelContext: true,
  });

  if (!decision.allowed) {
    throw new EgressDeniedError(
      decision.reason ?? "egress_denied",
      decision.receipt,
    );
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({ raw: input.raw }),
  });

  if (res.status === 401) {
    throw new TokenExpiredError(url);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new GoogleApiError(res.status, url, text);
  }

  const json = (await res.json()) as { id: string; threadId?: string };
  return {
    id: json.id,
    ...(json.threadId !== undefined && { threadId: json.threadId }),
    ...(decision.receipt !== undefined && { receipt: decision.receipt }),
  };
}

/**
 * Build and send a simple plain-text reply.
 */
export async function sendPlainTextReply(
  input: SendGmailReplyInput,
): Promise<SendGmailResult> {
  const raw = buildPlainTextEmail({
    from: input.from,
    to: input.to,
    subject: input.subject,
    body: input.body,
    ...(input.inReplyTo !== undefined && { inReplyTo: input.inReplyTo }),
    ...(input.references !== undefined && { references: input.references }),
  });

  return sendGmailMessage({
    accessToken: input.accessToken,
    raw,
    ...(input.idempotencyKey !== undefined && {
      idempotencyKey: input.idempotencyKey,
    }),
  });
}

/**
 * Build an RFC822 plain-text message (base64url encoded) with optional reply headers.
 */
export function buildPlainTextEmail(opts: {
  from: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string[];
}): string {
  const headers: string[] = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "MIME-Version: 1.0",
  ];

  if (opts.inReplyTo) {
    headers.push(`In-Reply-To: ${opts.inReplyTo}`);
  }
  if (opts.references?.length) {
    headers.push(`References: ${opts.references.join(" ")}`);
  }

  const message = `${headers.join("\r\n")}\r\n\r\n${opts.body}`;
  return Buffer.from(message, "utf-8").toString("base64url");
}
