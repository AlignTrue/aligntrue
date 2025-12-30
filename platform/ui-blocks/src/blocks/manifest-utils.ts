import { deterministicId } from "@aligntrue/ops-core";
import type { BlockManifest } from "@aligntrue/ui-contracts";
import { canonicalize } from "@aligntrue/ui-contracts";

export function finalizeManifest(
  manifest: Omit<BlockManifest, "manifest_hash" | "props_schema_hash">,
): BlockManifest {
  const props_schema_hash = deterministicId(
    canonicalize(manifest.props_schema),
  );
  const manifest_hash = deterministicId(
    canonicalize({
      ...manifest,
      props_schema_hash,
    }),
  );
  return {
    ...manifest,
    props_schema_hash,
    manifest_hash,
  };
}
