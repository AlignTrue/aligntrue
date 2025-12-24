import { GoogleApiError, TokenExpiredError } from "../google-common/errors.js";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface SendGmailMessageInput {
  accessToken: string;
  raw: string; // base64url encoded RFC822 message
  idempotencyKey?: string;
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
}

/**
 * Send a prepared RFC822 email (base64url encoded) to Gmail.
 */
export async function sendGmailMessage(
  input: SendGmailMessageInput,
): Promise<SendGmailResult> {
  const url = `${GMAIL_BASE}/messages/send`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
      ...(input.idempotencyKey
        ? { "X-Idempotency-Key": input.idempotencyKey }
        : {}),
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
