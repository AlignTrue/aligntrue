/**
 * Stub migration command (pre-1.0)
 *
 * Migration tooling will be added when we have 50+ active users or 10+ orgs.
 * Until then, schema may change without automated migrations.
 */

import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";

const ARG_DEFINITIONS: ArgDefinition[] = [];

export async function migrate(args: string[] = []): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help) {
    showStandardHelp({
      name: "migrate",
      description: "Schema migration tooling (not yet available, pre-1.0)",
      usage: "aligntrue migrate",
      args: ARG_DEFINITIONS,
      examples: ["aligntrue migrate"],
      notes: [
        "Migration framework will be added when we reach:",
        "  • 50+ active repositories using AlignTrue, OR",
        "  • 10+ organizations with multiple repos, OR",
        "  • A planned breaking change that significantly impacts users",
        "",
        "For now:",
        "  • Check CHANGELOG.md for breaking changes",
        "  • Follow migration guides for each release",
        "  • Pin CLI version if you need stability",
      ],
    });
    process.exit(0);
  }

  console.log(`
⚠️  Migration tooling not yet available

AlignTrue is in pre-1.0 status (spec_version: "1").
Schema may change between releases without automated migration tooling.

Migration framework will be added when we reach:
• 50+ active repositories using AlignTrue, OR
• 10+ organizations with multiple repos, OR
• A planned breaking change that significantly impacts users

For now:
• Check CHANGELOG.md for breaking changes
• Follow migration guides for each release
• Pin CLI version if you need stability

Current approach: Manual updates with clear guides
Future approach: Automated migrations with --write safeguard
  `);

  process.exit(0);
}
