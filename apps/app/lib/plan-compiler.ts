import { hashCanonical } from "@aligntrue/ops-core";
import { isValidSlot } from "@aligntrue/ui-contracts";
import type {
  BlockSlot,
  CompiledBlock,
  CompiledPlan,
  LayoutIntentCore,
  LayoutTemplate,
  RequiredSurface,
} from "@aligntrue/ui-contracts";
import type { UIContext } from "./ui-context";

export interface SurfaceBlockMapping {
  readonly block_type: string;
  readonly version: string;
  readonly manifest_hash: string;
  readonly slot: BlockSlot;
  readonly default_props: Record<string, unknown>;
}

export interface CompilerPolicy {
  readonly policy_id: string;
  readonly version: string;
  readonly policy_hash: string;
  readonly required_surfaces_by_intent: Record<
    string,
    readonly RequiredSurface[]
  >;
  readonly default_layout: LayoutTemplate;
  readonly surface_to_block: Record<RequiredSurface, SurfaceBlockMapping>;
}

export interface CompilerInputs {
  readonly context: UIContext;
  readonly policy: CompilerPolicy;
  readonly layoutIntentCore?: LayoutIntentCore;
  readonly allowed_manifest_hashes: ReadonlySet<string>;
  readonly allowed_block_types: ReadonlySet<string>;
}

export class CompilerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompilerError";
  }
}

export function compilePlan(inputs: CompilerInputs): CompiledPlan {
  const {
    context,
    policy,
    layoutIntentCore,
    allowed_manifest_hashes,
    allowed_block_types,
  } = inputs;

  const blocks = buildBlocks(context, policy, layoutIntentCore, {
    allowed_manifest_hashes,
    allowed_block_types,
  });

  const request_id = hashCanonical({
    context_hash: context.context_hash,
    policy_hash: policy.policy_hash,
    layout_intent_core_hash: layoutIntentCore
      ? hashCanonical(layoutIntentCore)
      : null,
  });

  return {
    request_id,
    blocks,
    layout: { template: layoutIntentCore?.layout ?? policy.default_layout },
  };
}

function buildBlocks(
  context: UIContext,
  policy: CompilerPolicy,
  layoutIntentCore: LayoutIntentCore | undefined,
  allowlists: {
    allowed_manifest_hashes: ReadonlySet<string>;
    allowed_block_types: ReadonlySet<string>;
  },
): CompiledBlock[] {
  const requestedSurfaces =
    layoutIntentCore?.must_include ??
    policy.required_surfaces_by_intent[context.intent] ??
    [];

  // 1) Dedupe surfaces
  const uniqueSurfaces = [...new Set(requestedSurfaces)];

  // 2) Track seen surfaces for uniqueness
  const seenSurfaces = new Set<RequiredSurface>();

  return uniqueSurfaces.map((surface, index) => {
    if (seenSurfaces.has(surface)) {
      throw new CompilerError(`Duplicate surface: ${surface}`);
    }
    seenSurfaces.add(surface);

    const mapping = Object.prototype.hasOwnProperty.call(
      policy.surface_to_block,
      surface,
    )
      ? // eslint-disable-next-line security/detect-object-injection
        policy.surface_to_block[surface]
      : undefined;

    if (!mapping) {
      throw new CompilerError(`No block mapping for surface: ${surface}`);
    }

    if (!allowlists.allowed_manifest_hashes.has(mapping.manifest_hash)) {
      throw new CompilerError(
        `Manifest hash not allowlisted: ${mapping.manifest_hash} for surface ${surface}`,
      );
    }

    if (!allowlists.allowed_block_types.has(mapping.block_type)) {
      throw new CompilerError(
        `Block type not allowlisted: ${mapping.block_type} for surface ${surface}`,
      );
    }

    if (!isValidSlot(mapping.slot)) {
      throw new CompilerError(
        `Invalid slot '${mapping.slot}' for surface ${surface}`,
      );
    }

    return {
      block_instance_id: hashCanonical({ surface, index }),
      block_type: mapping.block_type,
      block_version: mapping.version,
      manifest_hash: mapping.manifest_hash,
      slot: mapping.slot,
      surface_id: surface,
      props: buildPropsForSurface(surface, context, mapping.default_props),
    };
  });
}

function buildPropsForSurface(
  surface: RequiredSurface,
  context: UIContext,
  defaultProps: Record<string, unknown>,
): Record<string, unknown> {
  switch (surface) {
    case "tasks_list":
      return { ...defaultProps, tasks: context.tasks.items };
    case "notes_list":
      return { ...defaultProps, notes: context.notes.items };
    default:
      return { ...defaultProps };
  }
}
