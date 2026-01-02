import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchGmailPage, fetchAllGmailMessages } from "../src/index.js";
import { TokenExpiredError } from "@aligntrue/connector-google-common";

const originalFetch = globalThis.fetch;

describe("google gmail fetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("throws TokenExpiredError on gmail 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse(401, "auth failed"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await expect(
      fetchGmailPage({ accessToken: "expired" }),
    ).rejects.toBeInstanceOf(TokenExpiredError);
  });

  it("fetches gmail messages with details", async () => {
    const listPayload = {
      messages: [{ id: "m1", threadId: "t1" }],
    };
    const detailPayload = {
      id: "m1",
      threadId: "t1",
      internalDate: "1700000000000",
      labelIds: ["INBOX"],
      snippet: "hello",
      payload: {
        headers: [
          { name: "Subject", value: "Subj" },
          { name: "From", value: "alice@example.com" },
          { name: "To", value: "bob@example.com" },
        ],
      },
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockJsonResponse(listPayload))
      .mockResolvedValueOnce(mockJsonResponse(detailPayload));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchAllGmailMessages({
      accessToken: "token",
      maxResults: 10,
      query: "newer_than:7d",
    });

    expect(result.length).toBe(1);
    expect(result[0].subject).toBe("Subj");
    expect(result[0].from).toBe("alice@example.com");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

function mockJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockResponse(status: number, text: string): Response {
  return new Response(text, { status });
}
