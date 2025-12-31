import type { BlockManifest } from "@aligntrue/ui-contracts";

export interface RegistryLike {
  getManifest(blockType: string): BlockManifest | undefined;
  validateProps(
    blockType: string,
    props: unknown,
  ): { valid: boolean; errors?: string[] };
}
