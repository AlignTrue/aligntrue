import type { InputRef } from "./input-ref.js";

/**
 * PlanCore is the hashable portion of a RenderPlan.
 * It must exclude timestamps and other runtime-only fields.
 */
export interface PlanCore {
  readonly blocks: ReadonlyArray<PlanBlock>;
  readonly layout_template: string;
  readonly input_refs: ReadonlyArray<InputRef>;
  readonly policy_version: string;
}

export interface PlanBlock {
  readonly block_id: string;
  readonly block_version: string;
  readonly manifest_hash: string;
  readonly props: unknown; // validated props, not redacted
  readonly slot: string;
}
