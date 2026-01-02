import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchAllCalendarEvents } from "../src/index.js";

const originalFetch = globalThis.fetch;

describe("google calendar fetch", () => {
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
});

function mockJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
