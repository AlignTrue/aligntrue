import type { RenderPlan } from "@aligntrue/ui-contracts";
import React from "react";
import type { BlockRegistry } from "./registry.js";

export interface BlockRendererProps {
  readonly plan: RenderPlan;
  readonly registry: BlockRegistry;
  readonly onMissingBlock?: (blockId: string) => void;
}

export function BlockRenderer({
  plan,
  registry,
  onMissingBlock,
}: BlockRendererProps): React.ReactElement {
  return (
    <>
      {plan.core.blocks.map((block) => {
        const entry = registry.get(block.block_id);
        if (!entry) {
          onMissingBlock?.(block.block_id);
          return null;
        }
        const Component = entry.Component;
        return (
          <Component
            key={`${plan.plan_id}:${block.block_id}:${block.slot}`}
            {...(block.props as Record<string, unknown>)}
          />
        );
      })}
    </>
  );
}
