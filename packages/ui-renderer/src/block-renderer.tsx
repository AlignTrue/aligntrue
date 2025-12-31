import type { RenderPlan } from "@aligntrue/ui-contracts";
import React from "react";
import type { BlockShell } from "./shell.js";
import type { BlockRegistry } from "./registry.js";

export interface BlockRendererProps {
  readonly planId: string;
  readonly block: RenderPlan["core"]["blocks"][number];
  readonly registry: BlockRegistry;
  readonly shell: BlockShell;
  readonly onMissingBlock?: ((blockId: string) => void) | undefined;
}

export function BlockRenderer({
  planId,
  block,
  registry,
  shell,
  onMissingBlock,
}: BlockRendererProps): React.ReactElement | null {
  const entry = registry.get(block.block_type);
  if (!entry) {
    onMissingBlock?.(block.block_type);
    return null;
  }

  const { Frame, Header, Body } = shell;
  const Component = entry.Component;

  return (
    <Frame
      key={`${planId}:${block.block_instance_id}:${block.slot}`}
      manifest={entry.manifest}
      ui={entry.manifest.ui}
    >
      <Header title={entry.manifest.display_name ?? entry.manifest.block_id} />
      <Body>
        <Component {...(block.props as Record<string, unknown>)} />
      </Body>
    </Frame>
  );
}
