import { generateText, Output } from "ai";
import type { LanguageModel } from "ai";
import { z } from "zod";

export interface RetryOptions {
  readonly model: LanguageModel;
  readonly schema: z.ZodType;
  readonly prompt: string;
  readonly maxRetries?: number;
  readonly onValidationError?: (error: unknown, attempt: number) => void;
  readonly temperature?: number;
  readonly system?: string;
}

/**
 * Attempt to generate a structured object; if validation fails, feed the
 * validation error back to the model for a limited number of retries.
 */
export async function generateWithValidationRetry<T>({
  model,
  schema,
  prompt,
  maxRetries = 2,
  onValidationError,
  temperature,
  system,
}: RetryOptions): Promise<T> {
  let currentPrompt = prompt;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const result = await generateText({
        model,
        output: Output.object({ schema: schema as unknown as z.ZodType<T> }),
        ...(temperature !== undefined ? { temperature } : {}),
        ...(system !== undefined ? { system } : {}),
        prompt: currentPrompt,
      });
      return result.output as T;
    } catch (err) {
      lastError = err;
      onValidationError?.(err, attempt);
      if (attempt === maxRetries) break;

      const correctionHint = formatErrorForModel(err);
      currentPrompt = `${prompt}\n\nThe previous attempt failed validation:\n${correctionHint}\nPlease correct the output to satisfy the schema exactly.`;
    }
  }

  throw new Error(
    `Failed to produce valid structured output after ${maxRetries + 1} attempts: ${String(
      lastError,
    )}`,
  );
}

function formatErrorForModel(err: unknown): string {
  if (!err) return "Unknown validation error.";
  if (err instanceof Error && err.message) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
