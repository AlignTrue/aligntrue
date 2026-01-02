import { describe, expect, it, vi, beforeEach } from "vitest";
import { createAIProvider, type AIProviderConfig } from "../src/ai/factory.js";
import type {
  CalendarProvider,
  EmailProvider,
} from "../src/providers/index.js";

describe("provider registry", () => {
  beforeEach(() => {
    // Reset registries by re-importing registry module state
    vi.resetModules();
  });

  it("registers and retrieves calendar provider", async () => {
    const registry = await import("../src/providers/registry.js");
    const provider: CalendarProvider = {
      name: "mock_calendar",
      fetchEvents: vi.fn().mockResolvedValue([]),
    };
    registry.registerCalendarProvider(provider.name, provider);
    expect(registry.getCalendarProvider(provider.name)).toBe(provider);
  });

  it("registers and retrieves email provider", async () => {
    const registry = await import("../src/providers/registry.js");
    const provider: EmailProvider = {
      name: "mock_email",
      supportsMutations: false,
      fetchMessages: vi.fn().mockResolvedValue([]),
      fetchBodies: vi.fn().mockResolvedValue(new Map()),
    };
    registry.registerEmailProvider(provider.name, provider);
    expect(registry.getEmailProvider(provider.name)).toBe(provider);
  });

  it("throws helpful error for unknown provider", async () => {
    const { getCalendarProvider, getEmailProvider } =
      await import("../src/providers/index.js");
    expect(() => getCalendarProvider("missing")).toThrow(
      /Unknown calendar provider "missing"/,
    );
    expect(() => getEmailProvider("missing")).toThrow(
      /Unknown email provider "missing"/,
    );
  });

  it("lists registered providers", async () => {
    const { registerCalendarProvider, registerEmailProvider, listProviders } =
      await import("../src/providers/index.js");
    const MockCalendarProvider = class {
      name = "google_calendar";
      fetchEvents = vi.fn();
    };
    const MockEmailProvider = class {
      name = "google_gmail";
      supportsMutations = true;
      fetchMessages = vi.fn();
      fetchBodies = vi.fn();
    };
    registerCalendarProvider(
      "google_calendar",
      new MockCalendarProvider() as any,
    );
    registerEmailProvider("google_gmail", new MockEmailProvider() as any);
    expect(listProviders("calendar")).toContain("google_calendar");
    expect(listProviders("email")).toContain("google_gmail");
  });
});

describe("AI factory", () => {
  const baseConfig: AIProviderConfig = {
    provider: "openai",
    apiKey: "test-key",
    baseUrl: "http://localhost:1234/v1",
  };

  it("creates OpenAI provider", () => {
    const provider = createAIProvider({ ...baseConfig, provider: "openai" });
    expect(typeof provider).toBe("function");
  });

  it("creates Anthropic provider", () => {
    const provider = createAIProvider({ ...baseConfig, provider: "anthropic" });
    expect(typeof provider).toBe("function");
  });

  it("creates Google provider", () => {
    const provider = createAIProvider({ ...baseConfig, provider: "google" });
    expect(typeof provider).toBe("function");
  });

  it("creates custom provider with baseUrl", () => {
    const provider = createAIProvider({ ...baseConfig, provider: "custom" });
    expect(typeof provider).toBe("function");
  });

  it("throws on unknown provider type", () => {
    expect(() =>
      createAIProvider({ ...baseConfig, provider: "unknown" as never }),
    ).toThrow(/Unknown AI provider/);
  });
});

describe("Google providers (mocks)", () => {
  it("MockCalendarProvider implements CalendarProvider", async () => {
    const provider: CalendarProvider = {
      name: "google_calendar",
      fetchEvents: vi.fn().mockResolvedValue([]),
    };
    expect(provider.name).toBe("google_calendar");
    expect(provider.fetchEvents).toBeInstanceOf(Function);
  });

  it("MockEmailProvider implements EmailProvider", async () => {
    const provider: EmailProvider = {
      name: "google_gmail",
      supportsMutations: true,
      fetchMessages: vi.fn().mockResolvedValue([]),
      fetchBodies: vi.fn().mockResolvedValue(new Map()),
    };
    expect(provider.name).toBe("google_gmail");
    expect(provider.fetchMessages).toBeInstanceOf(Function);
    expect(provider.fetchBodies).toBeInstanceOf(Function);
    expect(provider.supportsMutations).toBe(true);
  });
});

describe("body fetcher adapter", () => {
  it("createBodyFetcher adapts provider to GmailBodyFetcher interface", async () => {
    const { createBodyFetcher } = await import("../src/providers/email.js");
    const provider: EmailProvider = {
      name: "mock_email",
      supportsMutations: false,
      fetchMessages: vi.fn().mockResolvedValue([]),
      fetchBodies: vi.fn().mockResolvedValue(new Map([["id", "body"]])),
    };
    const adapter = createBodyFetcher(provider, "token");
    const result = await adapter.fetchBodies(["id"]);
    expect(result.get("id")).toBe("body");
    expect(provider.fetchBodies).toHaveBeenCalledWith({
      accessToken: "token",
      messageIds: ["id"],
    });
  });
});
