import { GoogleApiError, TokenExpiredError } from "../google-common/errors.js";

export interface GmailMessage {
  id: string;
  threadId: string;
  internalDate: string;
  labelIds?: string[] | undefined;
  snippet?: string | undefined;
  subject?: string | undefined;
  from?: string | undefined;
  to?: string[] | undefined;
  cc?: string[] | undefined;
}

export interface FetchGmailOptions {
  accessToken: string;
  query?: string | undefined;
  maxResults?: number | undefined;
  includeBody?: boolean | undefined;
  pageToken?: string | undefined;
}

export interface FetchGmailResult {
  messages: GmailMessage[];
  nextPageToken?: string | undefined;
}

export interface GmailMessageBody {
  id: string;
  body?: string;
}

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export async function fetchGmailPage(
  opts: FetchGmailOptions,
): Promise<FetchGmailResult> {
  const query = opts.query ?? "newer_than:7d";
  const maxResults = opts.maxResults ?? 100;
  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
  });
  if (opts.pageToken) params.set("pageToken", opts.pageToken);

  const listUrl = `${GMAIL_BASE}/messages?${params.toString()}`;
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${opts.accessToken}` },
  });

  if (listRes.status === 401) {
    throw new TokenExpiredError(listUrl);
  }
  if (!listRes.ok) {
    const text = await listRes.text().catch(() => "unknown");
    throw new GoogleApiError(listRes.status, listUrl, text);
  }

  const listJson = (await listRes.json()) as {
    messages?: { id: string; threadId: string }[];
    nextPageToken?: string;
  };

  const ids = listJson.messages ?? [];
  if (ids.length === 0) {
    return {
      messages: [],
      ...(listJson.nextPageToken !== undefined && {
        nextPageToken: listJson.nextPageToken,
      }),
    };
  }

  const details = await Promise.all(
    ids.map((m) =>
      fetchMessageDetail(m.id, opts.accessToken, opts.includeBody ?? false),
    ),
  );

  return {
    messages: details,
    ...(listJson.nextPageToken !== undefined && {
      nextPageToken: listJson.nextPageToken,
    }),
  };
}

export async function fetchAllGmailMessages(
  opts: FetchGmailOptions,
): Promise<GmailMessage[]> {
  const messages: GmailMessage[] = [];
  let pageToken: string | undefined = opts.pageToken;

  do {
    const page = await fetchGmailPage({ ...opts, pageToken });
    messages.push(...page.messages);
    pageToken = page.nextPageToken;
  } while (pageToken);

  return messages;
}

/**
 * Fetch bodies for a set of Gmail message IDs (plain text if available).
 */
export async function fetchMessageBodies(
  messageIds: string[],
  accessToken: string,
): Promise<Map<string, string>> {
  const bodies = new Map<string, string>();
  if (messageIds.length === 0) return bodies;

  const results = await Promise.all(
    messageIds.map((id) => fetchMessageWithBody(id, accessToken)),
  );

  for (const result of results) {
    if (result.body !== undefined) {
      bodies.set(result.id, result.body);
    }
  }

  return bodies;
}

async function fetchMessageDetail(
  id: string,
  accessToken: string,
  includeBody: boolean,
): Promise<GmailMessage> {
  const params = new URLSearchParams({
    format: includeBody ? "full" : "metadata",
  });
  params.append("metadataHeaders", "From");
  params.append("metadataHeaders", "To");
  params.append("metadataHeaders", "Cc");
  params.append("metadataHeaders", "Subject");
  const url = `${GMAIL_BASE}/messages/${id}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401) {
    throw new TokenExpiredError(url);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new GoogleApiError(res.status, url, text);
  }

  const json = (await res.json()) as {
    id: string;
    threadId: string;
    labelIds?: string[];
    snippet?: string;
    internalDate?: string;
    payload?: {
      headers?: Array<{ name?: string; value?: string }>;
    };
  };

  return {
    id: json.id,
    threadId: json.threadId,
    internalDate: millisToIso(json.internalDate),
    ...(json.labelIds !== undefined && { labelIds: json.labelIds }),
    ...(json.snippet !== undefined && { snippet: json.snippet }),
    ...extractHeaders(json.payload?.headers ?? []),
  };
}

async function fetchMessageWithBody(
  id: string,
  accessToken: string,
): Promise<GmailMessageBody> {
  const url = `${GMAIL_BASE}/messages/${id}?format=full`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401) {
    throw new TokenExpiredError(url);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new GoogleApiError(res.status, url, text);
  }

  const json = (await res.json()) as {
    id: string;
    payload?: unknown;
  };

  const body = extractPlainTextBody(json.payload);
  return body !== undefined ? { id: json.id, body } : { id: json.id };
}

function extractPlainTextBody(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const p = payload as {
    mimeType?: string;
    body?: { data?: string };
    parts?: unknown[];
  };

  if (p.mimeType === "text/plain" && p.body?.data) {
    try {
      return Buffer.from(p.body.data, "base64").toString("utf-8");
    } catch {
      return undefined;
    }
  }

  if (Array.isArray(p.parts)) {
    for (const part of p.parts) {
      const text = extractPlainTextBody(part);
      if (text !== undefined) return text;
    }
  }

  return undefined;
}

function extractHeaders(headers: Array<{ name?: string; value?: string }>): {
  subject?: string;
  from?: string;
  to?: string[];
  cc?: string[];
} {
  const find = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value;

  const parseList = (val?: string) =>
    val
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const subject = find("Subject");
  const from = find("From");
  const to = parseList(find("To"));
  const cc = parseList(find("Cc"));

  return {
    ...(subject !== undefined && { subject }),
    ...(from !== undefined && { from }),
    ...(to !== undefined && { to }),
    ...(cc !== undefined && { cc }),
  };
}

function millisToIso(millis?: string): string {
  if (!millis) return new Date().toISOString();
  const asNumber = Number.parseInt(millis, 10);
  if (Number.isNaN(asNumber)) return new Date().toISOString();
  return new Date(asNumber).toISOString();
}
