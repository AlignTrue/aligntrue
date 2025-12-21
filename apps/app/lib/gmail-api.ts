const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GmailApiConfig {
  accessToken?: string;
}

function getAccessToken(config?: GmailApiConfig): string {
  const token =
    config?.accessToken ?? process.env["GMAIL_MUTATION_ACCESS_TOKEN"];
  if (!token) {
    throw new Error("GMAIL_MUTATION_ACCESS_TOKEN is not set");
  }
  return token;
}

export async function applyLabel(
  messageId: string,
  labelId: string,
  config?: GmailApiConfig,
): Promise<void> {
  const accessToken = getAccessToken(config);
  const res = await fetch(`${GMAIL_API_BASE}/messages/${messageId}/modify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ addLabelIds: [labelId] }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`applyLabel failed: ${res.status} ${text}`);
  }
}

export async function archive(
  threadId: string,
  config?: GmailApiConfig,
): Promise<void> {
  const accessToken = getAccessToken(config);
  const res = await fetch(`${GMAIL_API_BASE}/threads/${threadId}/modify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`archive failed: ${res.status} ${text}`);
  }
}
