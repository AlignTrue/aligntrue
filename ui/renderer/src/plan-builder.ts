import type {
  BlockInstance,
  BlockRequest,
  LayoutRequest,
  RenderPlan,
  RenderRequest,
} from "@aligntrue/ui-contracts";
import { computePlanId } from "@aligntrue/ui-contracts";
import type { PlanCore } from "@aligntrue/ui-contracts";
import type { InputRef } from "@aligntrue/ui-contracts";
import type { RegistryLike } from "./registry-interface.js";
import { validateLayoutTemplate } from "./layout-templates.js";

export interface BuildPlanOptions {
  readonly policy_version?: string;
  readonly now?: string;
  readonly capability_id?: string;
}

export function buildRenderPlan(
  request: RenderRequest,
  registry: RegistryLike,
  opts: BuildPlanOptions = {},
): RenderPlan {
  const layout_template = normalizeLayout(request.layout);
  const blocks = request.blocks.map((block) =>
    validateBlock(block, registry, layout_template),
  );

  const input_refs = normalizeInputRefs(request.input_refs);
  const policy_version = opts.policy_version ?? "ui@0.0.1";

  const core: PlanCore = {
    blocks: stableSortBlocks(blocks),
    layout_template,
    input_refs,
    policy_version,
  };

  const plan_id = computePlanId(core);
  const created_at = opts.now ?? new Date().toISOString();

  return {
    plan_id,
    core,
    meta: {
      request_id: request.request_id,
      actor: request.actor,
      ...(opts.capability_id ? { capability_id: opts.capability_id } : {}),
      correlation_id: request.correlation_id,
      created_at,
    },
  };
}

function normalizeLayout(layout: LayoutRequest): string {
  if (!validateLayoutTemplate(layout.template)) {
    throw new Error(`Unknown layout template: ${layout.template}`);
  }
  return layout.template;
}

function validateBlock(
  block: BlockRequest,
  registry: RegistryLike,
  _layoutTemplate: string,
): BlockInstance {
  const manifest = registry.getManifest(block.block_type);
  if (!manifest) {
    throw new Error(`Unknown block_type: ${block.block_type}`);
  }

  const validation = registry.validateProps(block.block_type, block.props);
  if (!validation.valid) {
    const message = validation.errors?.join("; ") ?? "Unknown validation error";
    throw new Error(
      `Props invalid for block ${block.block_instance_id}: ${message}`,
    );
  }

  // Note: layoutTemplate is currently only name; slots enforced at composition time.
  return {
    block_instance_id: block.block_instance_id,
    block_type: block.block_type,
    block_version: manifest.version,
    manifest_hash: manifest.manifest_hash,
    props: block.props,
    slot: block.slot,
  };
}

function normalizeInputRefs(inputRefs: InputRef[]): InputRef[] {
  const dedup = new Map<string, InputRef>();
  for (const ref of inputRefs) {
    const key = `${ref.artifact_type}:${ref.artifact_id}`;
    if (!dedup.has(key)) {
      dedup.set(key, ref);
    }
  }
  return Array.from(dedup.values()).sort((a, b) => {
    if (a.artifact_type !== b.artifact_type) {
      return a.artifact_type < b.artifact_type ? -1 : 1;
    }
    return a.artifact_id < b.artifact_id ? -1 : 1;
  });
}

function stableSortBlocks(blocks: BlockInstance[]): BlockInstance[] {
  return [...blocks].sort((a, b) => {
    if (a.slot !== b.slot) return a.slot < b.slot ? -1 : 1;
    if (a.block_instance_id !== b.block_instance_id) {
      return a.block_instance_id < b.block_instance_id ? -1 : 1;
    }
    return 0;
  });
}
