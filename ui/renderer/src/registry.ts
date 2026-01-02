import type { BlockManifest } from "@aligntrue/ui-contracts";
import Ajv, { type AnySchema } from "ajv";
import addFormats from "ajv-formats";
import type { ComponentType } from "react";

export interface BlockRegistryEntry<Props = Record<string, unknown>> {
  readonly manifest: BlockManifest;
  readonly Component: ComponentType<Props>;
  readonly validate: (data: unknown) => ValidationResult;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors?: string[];
}

export type BlockRegistry = Map<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BlockRegistryEntry<any>
>;

export interface RegistryFactoryOptions {
  readonly ajv?: Ajv;
}

export function createBlockRegistry(
  items: Array<{
    manifest: BlockManifest;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Component: ComponentType<any>;
  }>,
  opts: RegistryFactoryOptions = {},
): BlockRegistry {
  const ajv = initAjv(opts.ajv);
  const registry: BlockRegistry = new Map();

  for (const { manifest, Component } of items) {
    const validateFn = ajv.compile(manifest.props_schema as AnySchema);
    registry.set(manifest.block_id, {
      manifest,
      Component,
      validate: (data: unknown) => {
        const valid = validateFn(data);
        return valid
          ? { valid: true }
          : {
              valid: false,
              errors: (validateFn.errors ?? []).map((e) =>
                `${e.instancePath || "/"} ${e.message ?? ""}`.trim(),
              ),
            };
      },
    });
  }

  return registry;
}

function initAjv(existing?: Ajv): Ajv {
  if (existing) return existing;
  const ajv = new Ajv({ strict: true, allErrors: true });
  addFormats(ajv);
  ajv.addKeyword("x-sensitive");
  ajv.addKeyword("x-redaction");
  return ajv;
}
