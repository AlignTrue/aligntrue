import { generateText, Output } from "ai";
import type { z } from "zod";
import {
  OPS_AI_BASE_URL,
  OPS_AI_API_KEY,
  OPS_AI_MODEL,
  OPS_AI_PROVIDER,
} from "../config.js";
import {
  createAIProvider,
  type AIProviderConfig,
  type AIProviderType,
} from "./factory.js";
import { ValidationError } from "../errors.js";

const ALLOWED_PROVIDERS: readonly AIProviderType[] = [
  "openai",
  "anthropic",
  "google",
  "custom",
] as const;

function resolveProvider(raw: string | undefined): AIProviderType {
  if (!raw) return "openai";
  if (ALLOWED_PROVIDERS.includes(raw as AIProviderType)) {
    return raw as AIProviderType;
  }
  const allowed = ALLOWED_PROVIDERS.join(", ");
  throw new ValidationError(
    `OPS_AI_PROVIDER must be one of [${allowed}], received "${raw}"`,
    { value: raw, allowed },
  );
}

const providerConfig: AIProviderConfig = {
  provider: resolveProvider(OPS_AI_PROVIDER),
  apiKey: OPS_AI_API_KEY,
  baseUrl: OPS_AI_BASE_URL,
  defaultModel: OPS_AI_MODEL,
};

const provider = createAIProvider(providerConfig);

export interface StructuredOutputResult<T> {
  data: T;
  usage?: { promptTokens: number; completionTokens: number };
}

export async function generateStructuredOutput<T>(opts: {
  prompt: string;
  schema: z.ZodType<T>;
  model?: string;
}): Promise<StructuredOutputResult<T>> {
  const response = await generateText({
    model: provider(opts.model ?? OPS_AI_MODEL),
    prompt: opts.prompt,
    // The AI SDK types lag the output helper; cast through unknown to allow structured output.
    output: Output.object({ schema: opts.schema }),
  } as unknown as Parameters<typeof generateText>[0]);

  const result = response as unknown as {
    output: T;
    usage?: { promptTokens: number; completionTokens: number };
  };

  return {
    data: result.output as T,
    ...(result.usage ? { usage: result.usage } : {}),
  };
}
