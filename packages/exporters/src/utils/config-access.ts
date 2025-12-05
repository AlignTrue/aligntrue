/**
 * Typed accessors for exporter configuration
 */
import type { AlignTrueConfig } from "@aligntrue/core";

type ContentMode = "auto" | "inline" | "links";

/**
 * Resolve sync.content_mode with CLI override support.
 * Defaults to "auto" when unset.
 */
export function getContentMode(
  config: unknown,
  cliOption?: string,
): ContentMode {
  if (cliOption) {
    return cliOption as ContentMode;
  }

  const alignConfig = config as Partial<AlignTrueConfig> | undefined;
  return (alignConfig?.sync?.content_mode as ContentMode | undefined) ?? "auto";
}
