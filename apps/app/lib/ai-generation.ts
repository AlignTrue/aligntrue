import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { deterministicId } from "@aligntrue/ops-core";
import type { BlockManifest } from "@aligntrue/ui-contracts";
import { createRenderPageTool } from "@aligntrue/ui-blocks";
import type { UIContext } from "./ui-context";
import { buildRenderPagePrompt } from "./prompts/render-page";
import { extractRenderRequest, normalizeAIResult } from "./ai";

export interface GenerateRenderPlanResult {
  readonly request: ReturnType<typeof extractRenderRequest>;
  readonly errors: string[];
  readonly attempts: number;
}

export async function generateRenderPlan(opts: {
  context: UIContext;
  manifests: BlockManifest[];
  actor: { actor_id: string; actor_type: string };
  model?: string;
  maxAttempts?: number;
}): Promise<GenerateRenderPlanResult> {
  const errors: string[] = [];
  const attempts = Math.max(opts.maxAttempts ?? 3, 1);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      request: null,
      errors: ["missing_openai_api_key"],
      attempts: 0,
    };
  }

  const modelName = opts.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const baseUrl = process.env.OPENAI_BASE_URL;
  const provider = createOpenAI(
    baseUrl ? { apiKey, baseURL: baseUrl } : { apiKey },
  );
  const model = provider(modelName);

  const request_id = deterministicId({
    context_hash: opts.context.context_hash,
    intent: opts.context.intent,
    scope: opts.context.scope,
  });
  const correlation_id = deterministicId({
    request_id,
    ts: Date.now(),
  });

  const system = buildRenderPagePrompt(
    opts.context,
    opts.manifests.map((m) => m.block_id),
  );
  const tools = {
    render_page: createRenderPageTool(opts.manifests),
  };

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const result = await generateText({
        model,
        tools,
        toolChoice: "required",
        system,
        prompt: JSON.stringify({
          context: opts.context,
          actor: opts.actor,
          request_id,
          correlation_id,
        }),
      });

      const normalized = normalizeAIResult(result);
      const request = extractRenderRequest(normalized, {
        request_id,
        actor: opts.actor,
        correlation_id,
      });
      if (request) {
        return { request, errors, attempts: attempt + 1 };
      }

      errors.push("validation_failed");
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return { request: null, errors, attempts };
}
