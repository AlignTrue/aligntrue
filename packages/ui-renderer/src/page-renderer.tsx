import type { RenderPlan } from "@aligntrue/ui-contracts";
import React from "react";
import type { BlockShell } from "./shell.js";
import { BlockRenderer } from "./block-renderer.js";
import type { BlockRegistry } from "./registry.js";
import { LAYOUT_TEMPLATES } from "./layout-templates.js";
import type { LayoutTemplateId } from "./layout-templates.js";

export interface PageRendererProps {
  readonly plan: RenderPlan;
  readonly registry: BlockRegistry;
  readonly shell: BlockShell;
  readonly onMissingBlock?: ((blockId: string) => void) | undefined;
}

/**
 * Minimal deterministic page renderer that places blocks into named slots.
 * Consumers can wrap slots with their own layout components.
 */
export function PageRenderer({
  plan,
  registry,
  shell,
  onMissingBlock,
}: PageRendererProps): React.ReactElement {
  const template =
    LAYOUT_TEMPLATES[plan.core.layout_template as LayoutTemplateId];
  if (!template) {
    throw new Error(`Unknown layout template: ${plan.core.layout_template}`);
  }

  const bySlot = new Map<string, React.ReactNode[]>();
  for (const slot of template.slots) bySlot.set(slot, []);

  for (const block of plan.core.blocks) {
    const bucket = bySlot.get(block.slot);
    if (!bucket) {
      onMissingBlock?.(block.block_type);
      continue;
    }
    bucket.push(
      <BlockRenderer
        key={`${plan.plan_id}:${block.block_instance_id}:${block.slot}`}
        planId={plan.plan_id}
        block={block}
        registry={registry}
        shell={shell}
        onMissingBlock={onMissingBlock}
      />,
    );
  }

  return (
    <>
      {template.slots.map((slot: string) => (
        <section key={slot} data-slot={slot}>
          {bySlot.get(slot)}
        </section>
      ))}
    </>
  );
}
