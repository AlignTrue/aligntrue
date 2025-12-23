import { generateText, Output } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { z } from "zod";
import { OPS_AI_BASE_URL, OPS_AI_API_KEY, OPS_AI_MODEL } from "../config.js";

const provider = createOpenAI({
  baseURL: OPS_AI_BASE_URL,
  apiKey: OPS_AI_API_KEY,
});

export interface StructuredOutputResult<T> {
  data: T;
  usage?: { promptTokens: number; completionTokens: number };
}

export async function generateStructuredOutput<T>(opts: {
  prompt: string;
  schema: z.ZodSchema<T>;
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
