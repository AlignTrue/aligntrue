import type { BlockSlot } from "./block-slot.js";
import type { LayoutTemplate, RequiredSurface } from "./layout-intent.js";

export interface CompiledBlock {
  readonly block_instance_id: string;
  readonly block_type: string;
  readonly block_version: string;
  readonly manifest_hash: string;
  readonly slot: BlockSlot;
  readonly surface_id?: RequiredSurface;
  readonly props: Record<string, unknown>;
}

export interface CompiledPlan {
  readonly request_id: string;
  readonly blocks: readonly CompiledBlock[];
  readonly layout: { readonly template: LayoutTemplate };
}
