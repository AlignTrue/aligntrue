import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { ValidationError } from "../errors.js";

export type AIProviderType = "openai" | "anthropic" | "google" | "custom";

export interface AIProviderConfig {
  provider: AIProviderType;
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}

/**
 * Return a provider factory from @ai-sdk/* packages based on config.
 * - openai/custom: OpenAI-compatible endpoints (LM Studio, Ollama, Azure)
 * - anthropic: Anthropic provider
 * - google: Gemini provider
 */
export function createAIProvider(config: AIProviderConfig) {
  switch (config.provider) {
    case "openai":
    case "custom":
      return createOpenAI(
        config.baseUrl
          ? { apiKey: config.apiKey, baseURL: config.baseUrl }
          : { apiKey: config.apiKey },
      );
    case "anthropic":
      return createAnthropic({ apiKey: config.apiKey });
    case "google":
      return createGoogleGenerativeAI({ apiKey: config.apiKey });
    default:
      throw new ValidationError("Unknown AI provider", {
        provider: config.provider,
      });
  }
}
