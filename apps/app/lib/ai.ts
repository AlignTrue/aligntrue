import type { RenderRequest } from "@aligntrue/ui-contracts";
import { z } from "zod";

interface RawSDKToolCall {
  toolName?: string;
  name?: string;
  args?: unknown;
  input?: unknown;
}

export interface AIResult {
  readonly toolCalls?: Array<{ toolName: string; args: unknown }>;
}

const InputRefSchema = z.object({
  artifact_type: z.enum(["message", "projection", "document", "tool_output"]),
  artifact_id: z.string(),
});

const RenderRequestSchema = z.object({
  request_id: z.string(),
  blocks: z.array(
    z.object({
      block_id: z.string(),
      slot: z.string(),
      // allow any props; schema enforcement happens server-side
      props: z.record(z.string(), z.unknown()).passthrough(),
    }),
  ),
  layout: z.object({
    template: z.enum(["single", "split", "dashboard", "inbox"]),
  }),
  input_refs: z.array(InputRefSchema).default([]),
  correlation_id: z.string(),
  actor: z.object({
    actor_id: z.string(),
    actor_type: z.string(),
  }),
});

function extractToolCalls(raw: unknown): RawSDKToolCall[] {
  if (!raw || typeof raw !== "object") return [];
  const candidate = raw as Record<string, unknown>;
  if (Array.isArray(candidate.toolCalls))
    return candidate.toolCalls as RawSDKToolCall[];
  if (Array.isArray(candidate.tool_calls))
    return candidate.tool_calls as RawSDKToolCall[];
  if (candidate.tool_call && typeof candidate.tool_call === "object") {
    return [candidate.tool_call as RawSDKToolCall];
  }
  return [];
}

export function normalizeAIResult(raw: unknown): AIResult {
  const toolCalls = extractToolCalls(raw).map((tc) => ({
    toolName: tc.toolName ?? tc.name ?? "",
    args: tc.args ?? tc.input ?? {},
  }));
  return { toolCalls };
}

export function extractRenderRequest(result: AIResult): RenderRequest | null {
  const toolCall = result.toolCalls?.find(
    (tc) => tc.toolName === "render_page",
  );
  if (!toolCall) return null;
  const parsed = RenderRequestSchema.safeParse(toolCall.args);
  if (!parsed.success) return null;
  return parsed.data as RenderRequest;
}
