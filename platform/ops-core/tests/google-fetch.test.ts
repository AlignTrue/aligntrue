import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchAllCalendarEvents } from "../src/connectors/google-calendar/fetch.js";
import {
  fetchGmailPage,
  fetchAllGmailMessages,
} from "../src/connectors/google-gmail/fetch.js";
import { TokenExpiredError } from "../src/connectors/google-common/errors.js";

const originalFetch = globalThis.fetch;

describe("google fetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("fetches calendar events with pagination", async () => {
    const firstPage = {
      items: [
        {
          id: "evt-1",
          updated: "2024-01-01T00:00:00Z",
          summary: "A",
          start: { dateTime: "2024-01-02T00:00:00Z" },
        },
      ],
      nextPageToken: "next",
    };
    const secondPage = {
      items: [
        {
          id: "evt-2",
          updated: "2024-01-02T00:00:00Z",
          summary: "B",
          start: { dateTime: "2024-01-03T00:00:00Z" },
        },
      ],
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockJsonResponse(firstPage))
      .mockResolvedValueOnce(mockJsonResponse(secondPage));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchAllCalendarEvents({
      accessToken: "token",
      timeMin: "2024-01-01T00:00:00Z",
      timeMax: "2024-02-01T00:00:00Z",
      maxResults: 1,
    });

    expect(result.length).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
