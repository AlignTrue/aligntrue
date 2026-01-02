import type { PackManifest } from "@aligntrue/core";

/**
 * Minimal pack loader placeholder. Resolves pack manifests and
 * prepares them for registration with the host runtime.
 */
export interface LoadedPack {
  manifest: PackManifest;
  module: unknown;
}

export interface LoadPackOptions {
  /**
   * Absolute or workspace-relative module specifier.
   */
  specifier: string;
}

export async function loadPack(opts: LoadPackOptions): Promise<LoadedPack> {
  const module = await import(opts.specifier);
  const manifest: PackManifest =
    (module?.manifest as PackManifest | undefined) ??
    (module?.default as PackManifest | undefined) ??
    (() => {
      throw new Error(`Pack manifest not found in ${opts.specifier}`);
    })();

  return { manifest, module };
}
