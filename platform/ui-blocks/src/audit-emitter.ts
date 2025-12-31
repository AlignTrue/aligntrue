import type { EventStore } from "@aligntrue/ops-core";
import { Identity } from "@aligntrue/ops-core";
import type { RenderPlan, BlockManifest } from "@aligntrue/ui-contracts";
import type { JSONSchema7 } from "@aligntrue/ui-contracts";
import { applySchemaRedaction } from "@aligntrue/ui-renderer";

export interface RenderedTelemetry {
  readonly plan_id: string;
  readonly block_id: string;
  readonly rendered_at: string;
}

export async function emitPlanAccepted(params: {
  eventStore: EventStore;
  plan: RenderPlan;
  manifests: Map<string, BlockManifest>;
  now?: string;
}): Promise<void> {
  const { eventStore, plan, manifests } = params;
  const now = params.now ?? new Date().toISOString();

  const blocksPayload = plan.core.blocks.map((block) => {
    const manifest = manifests.get(block.block_type);
    if (!manifest) {
      return {
        block_instance_id: block.block_instance_id,
        block_type: block.block_type,
        block_version: block.block_version,
        slot: block.slot,
        props_hash: Identity.deterministicId(JSON.stringify(block.props)),
      };
    }

    const { redacted, warnings } = applySchemaRedaction(
      block.props,
      manifest.props_schema as JSONSchema7,
      manifest.redaction_policy,
    );
    for (const w of warnings) {
      // Log but do not throw; upstream can hook logger if desired.
      console.warn(
        `[ui-blocks] Redaction warning for ${block.block_instance_id}: ${w}`,
      );
    }

    return {
      block_instance_id: block.block_instance_id,
      block_type: block.block_type,
      block_version: block.block_version,
      slot: block.slot,
      props_hash: Identity.deterministicId(JSON.stringify(block.props)),
      props_redacted: redacted,
    };
  });

  await eventStore.append({
    event_id: Identity.randomId(),
    event_type: "ui.plan.accepted",
    payload: {
      plan_id: plan.plan_id,
      layout_template: plan.core.layout_template,
      input_refs: plan.core.input_refs,
      blocks: blocksPayload,
    },
    occurred_at: plan.meta.created_at,
    ingested_at: now,
    correlation_id: plan.meta.correlation_id,
    actor: plan.meta.actor,
    envelope_version: 1,
    payload_schema_version: 1,
  });
}

export async function emitRenderedTelemetry(params: {
  eventStore: EventStore;
  telemetry: RenderedTelemetry;
  now?: string;
}): Promise<void> {
  const { eventStore, telemetry } = params;
  const now = params.now ?? new Date().toISOString();

  await eventStore.append({
    event_id: Identity.randomId(),
    event_type: "ui.block.rendered",
    payload: {
      plan_id: telemetry.plan_id,
      block_id: telemetry.block_id,
      client_reported_at: telemetry.rendered_at,
    },
    occurred_at: now,
    ingested_at: now,
    correlation_id: telemetry.plan_id,
    actor: { actor_id: "system", actor_type: "service" },
    envelope_version: 1,
    payload_schema_version: 1,
  });
}
