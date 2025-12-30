import type { RenderPlan } from "@aligntrue/ui-contracts";
import React from "react";
import type { BlockRegistry } from "./registry.js";
import { LAYOUT_TEMPLATES } from "./layout-templates.js";
import type { LayoutTemplateId } from "./layout-templates.js";

export interface PageRendererProps {
  readonly plan: RenderPlan;
  readonly registry: BlockRegistry;
  readonly onMissingBlock?: (blockId: string) => void;
}

/**
 * Minimal deterministic page renderer that places blocks into named slots.
 * Consumers can wrap slots with their own layout components.
 */
export function PageRenderer({
  plan,
  registry,
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
    const entry = registry.get(block.block_id);
    if (!entry) {
      onMissingBlock?.(block.block_id);
      continue;
    }
    const Component = entry.Component;
    const bucket = bySlot.get(block.slot);
    if (!bucket) {
      onMissingBlock?.(block.block_id);
      continue;
    }
    bucket.push(
      <Component
        key={`${plan.plan_id}:${block.block_id}:${block.slot}`}
        {...(block.props as Record<string, unknown>)}
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
