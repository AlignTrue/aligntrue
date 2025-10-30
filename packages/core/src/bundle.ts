/**
 * Bundle merge with dependency precedence (team mode only)
 */

export interface BundleOptions {
  sources: string[];
  outputPath: string;
}

export async function createBundle(options: BundleOptions): Promise<void> {
  throw new Error("Not implemented - team mode only");
}
