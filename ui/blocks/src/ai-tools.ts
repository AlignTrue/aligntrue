import { tool } from "ai";
import { z } from "zod";
import type { BlockManifest } from "@aligntrue/ui-contracts";

/**
 * Tool exposed to the model to request a specific block render.
 * Registry allowlist should be enforced at the call site by constraining
 * block_type to known manifests.
 */
export function createRenderBlockTool(manifests: BlockManifest[]) {
  const allowed = manifests.map((m) => m.block_id);
  return tool({
    description: "Request rendering of a UI block from the allowlist",
    parameters: z.object({
      block_instance_id: z.string(),
      block_type: z.enum(allowed as [string, ...string[]]),
      slot: z.string(),
      props: z.record(z.string(), z.unknown()),
      correlation_id: z.string(),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

/**
 * Tool to request a page layout with multiple blocks.
 */
export function createRenderPageTool(manifests: BlockManifest[]) {
  const allowed = manifests.map((m) => m.block_id);
  return tool({
    description: "Request a page composed of registered blocks",
    parameters: z.object({
      request_id: z.string(),
      actor: z.object({
        actor_id: z.string(),
        actor_type: z.string(),
      }),
      layout: z.enum(["single", "split", "dashboard", "inbox"]),
      blocks: z.array(
        z.object({
          block_instance_id: z.string(),
          block_type: z.enum(allowed as [string, ...string[]]),
          slot: z.string(),
          props: z.record(z.string(), z.unknown()),
        }),
      ),
      input_refs: z
        .array(
          z.object({
            artifact_type: z.enum([
              "message",
              "projection",
              "document",
              "tool_output",
            ]),
            artifact_id: z.string(),
          }),
        )
        .default([]),
      correlation_id: z.string(),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}
