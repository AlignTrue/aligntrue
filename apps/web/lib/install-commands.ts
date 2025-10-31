/**
 * Install command generation for catalog packs (Phase 4, Session 5)
 *
 * Generates installation commands with tracking and plug configuration.
 */

import type { CatalogEntryExtended, RequiredPlug } from "@aligntrue/schema";

/**
 * Command structure for installation modal
 */
export interface InstallCommand {
  /** Display label (e.g., "Install CLI", "Add pack") */
  label: string;
  /** Shell command to execute */
  command: string;
  /** Whether this step is required */
  required: boolean;
  /** Optional help text */
  help?: string;
}

/**
 * Generate installation commands for a pack
 *
 * Returns array of commands in execution order:
 * 1. CLI installation (always first, conditional on CLI not installed)
 * 2. Pack installation with tracking flag
 * 3. Plug configuration (conditional on required plugs)
 *
 * @param pack - Catalog pack entry
 * @returns Array of installation commands
 */
export function generateInstallCommands(
  pack: CatalogEntryExtended,
): InstallCommand[] {
  const commands: InstallCommand[] = [];

  // 1. CLI installation (conditional - user may already have CLI)
  commands.push({
    label: "Install AlignTrue CLI",
    command: "curl -fsSL https://aligntrue.ai/install.sh | bash",
    required: false,
    help: "Skip if you already have AlignTrue installed",
  });

  // 2. Pack installation with tracking
  commands.push({
    label: "Add pack",
    command: `aligntrue add catalog:${pack.id}@${pack.version} --from=catalog_web`,
    required: true,
    help: "The --from flag helps us measure catalog usage (transparent tracking)",
  });

  // 3. Plug configuration (conditional on required plugs)
  if (pack.required_plugs && pack.required_plugs.length > 0) {
    // Generate a command for each required plug
    for (const plug of pack.required_plugs) {
      const placeholder = plug.default || `<${plug.key}>`;
      commands.push({
        label: `Configure ${plug.key}`,
        command: `aln plugs set ${plug.key} "${placeholder}"`,
        required: true,
        help: plug.description,
      });
    }
  }

  return commands;
}

/**
 * Format all commands as a single copy-pasteable block
 *
 * @param commands - Array of install commands
 * @returns Formatted command block
 */
export function formatCommandBlock(commands: InstallCommand[]): string {
  return commands
    .map((cmd) => {
      const parts: string[] = [];

      // Add comment with label
      parts.push(`# ${cmd.label}`);

      // Add help text if present
      if (cmd.help) {
        parts.push(`# ${cmd.help}`);
      }

      // Add command
      parts.push(cmd.command);

      return parts.join("\n");
    })
    .join("\n\n");
}

/**
 * Generate download filename for pack YAML
 *
 * @param pack - Catalog pack entry
 * @returns Filename (e.g., "base-global-v1.0.0.yaml")
 */
export function generateDownloadFilename(pack: CatalogEntryExtended): string {
  // Extract last segment of pack ID for filename
  const segments = pack.id.split("/");
  const packName = segments[segments.length - 1] || "pack";

  return `${packName}-v${pack.version}.yaml`;
}

/**
 * Find exporter preview by format
 *
 * @param pack - Catalog pack entry
 * @param format - Exporter format (e.g., "yaml", "cursor")
 * @returns Preview content or null if not found
 */
export function findExporterPreview(
  pack: CatalogEntryExtended,
  format: string,
): string | null {
  const exporter = pack.exporters.find((e) => e.format === format);
  return exporter?.preview || null;
}
