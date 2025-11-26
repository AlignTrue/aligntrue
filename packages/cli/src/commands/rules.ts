/**
 * Rules management commands
 * List rules and view targeting information
 */

import * as clack from "@clack/prompts";
import { join } from "path";
import {
  loadConfig,
  loadRulesDirectory,
  getExporterNames,
} from "@aligntrue/core";
import type { RuleFile } from "@aligntrue/schema";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";

/**
 * Main rules command handler
 */
export async function rules(args: string[]): Promise<void> {
  const subcommand = args[0];
  const flags = parseFlags(args.slice(1));

  switch (subcommand) {
    case "list":
      await listRules(flags);
      break;
    case undefined:
    case "--help":
    case "-h":
      showHelp();
      break;
    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      showHelp();
      process.exit(1);
  }
}

/**
 * Parse command flags
 */
interface RulesFlags {
  byAgent: boolean;
  json: boolean;
}

function parseFlags(args: string[]): RulesFlags {
  const flags: RulesFlags = {
    byAgent: false,
    json: false,
  };

  for (const arg of args) {
    if (arg === "--by-agent") {
      flags.byAgent = true;
    } else if (arg === "--json") {
      flags.json = true;
    }
  }

  return flags;
}

/**
 * Check if a rule should be exported to a given agent
 */
function shouldExportToAgent(rule: RuleFile, agentName: string): boolean {
  const frontmatter = rule.frontmatter;

  // Check export_only_to (allowlist)
  if (frontmatter.export_only_to && frontmatter.export_only_to.length > 0) {
    return frontmatter.export_only_to.includes(agentName);
  }

  // Check exclude_from (blocklist)
  if (frontmatter.exclude_from && frontmatter.exclude_from.length > 0) {
    return !frontmatter.exclude_from.includes(agentName);
  }

  // Default: export to all agents
  return true;
}

/**
 * List all rules, optionally grouped by agent
 */
async function listRules(flags: RulesFlags): Promise<void> {
  const cwd = process.cwd();
  const byAgent = flags.byAgent;
  const jsonOutput = flags.json;

  try {
    if (!jsonOutput) {
      clack.intro("Rules");
    }

    // Load config
    const config = await loadConfig(undefined, cwd);

    // Load rule files from the rules directory
    const rulesDir = join(cwd, ".aligntrue", "rules");
    const ruleFiles = await loadRulesDirectory(rulesDir, cwd, {
      recursive: true,
    });

    if (ruleFiles.length === 0) {
      if (jsonOutput) {
        console.log(JSON.stringify({ rules: [], byAgent: {} }));
      } else {
        clack.log.warn("No rules found in .aligntrue/rules/");
        clack.outro("Done");
      }
      return;
    }

    if (byAgent) {
      // Group rules by agent
      const exporterNames = getExporterNames(config.exporters);
      const effectiveExporters =
        exporterNames.length > 0 ? exporterNames : ["cursor", "agents"];

      const rulesByAgent: Record<
        string,
        { included: string[]; excluded: string[] }
      > = {};

      for (const exporterName of effectiveExporters) {
        rulesByAgent[exporterName] = { included: [], excluded: [] };
      }

      for (const rule of ruleFiles) {
        for (const exporterName of effectiveExporters) {
          if (shouldExportToAgent(rule, exporterName)) {
            rulesByAgent[exporterName]!.included.push(rule.filename);
          } else {
            rulesByAgent[exporterName]!.excluded.push(rule.filename);
          }
        }
      }

      if (jsonOutput) {
        console.log(
          JSON.stringify(
            {
              totalRules: ruleFiles.length,
              exporters: effectiveExporters,
              byAgent: rulesByAgent,
            },
            null,
            2,
          ),
        );
      } else {
        clack.log.success(`Found ${ruleFiles.length} rules\n`);
        console.log("Rules by agent:\n");

        for (const [agentName, { included, excluded }] of Object.entries(
          rulesByAgent,
        )) {
          console.log(`  ${agentName}:`);
          if (included.length > 0) {
            for (const ruleName of included) {
              console.log(`    - ${ruleName}`);
            }
          } else {
            console.log(`    (no rules)`);
          }

          if (excluded.length > 0) {
            console.log(`    excluded:`);
            for (const ruleName of excluded) {
              console.log(`      - ${ruleName} (via targeting)`);
            }
          }
          console.log("");
        }

        clack.outro("Done");
      }
    } else {
      // Simple list of all rules
      if (jsonOutput) {
        console.log(
          JSON.stringify(
            {
              totalRules: ruleFiles.length,
              rules: ruleFiles.map((r) => ({
                filename: r.filename,
                path: r.path,
                title: r.frontmatter.title,
                exportOnlyTo: r.frontmatter.export_only_to,
                excludeFrom: r.frontmatter.exclude_from,
              })),
            },
            null,
            2,
          ),
        );
      } else {
        clack.log.success(
          `Found ${ruleFiles.length} rule${ruleFiles.length !== 1 ? "s" : ""} in .aligntrue/rules/:\n`,
        );

        for (const rule of ruleFiles) {
          const title = rule.frontmatter.title || rule.filename;
          const targeting = [];

          if (
            rule.frontmatter.export_only_to &&
            rule.frontmatter.export_only_to.length > 0
          ) {
            targeting.push(
              `only: ${rule.frontmatter.export_only_to.join(", ")}`,
            );
          }
          if (
            rule.frontmatter.exclude_from &&
            rule.frontmatter.exclude_from.length > 0
          ) {
            targeting.push(
              `excludes: ${rule.frontmatter.exclude_from.join(", ")}`,
            );
          }

          const targetingInfo =
            targeting.length > 0 ? ` (${targeting.join("; ")})` : "";
          console.log(`  - ${title}${targetingInfo}`);
        }

        clack.outro("Done");
      }
    }

    recordEvent({ command_name: "rules", align_hashes_used: [] });
  } catch (error) {
    if (jsonOutput) {
      console.log(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    } else {
      clack.log.error(
        `Failed to list rules: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    process.exit(1);
  }
}

/**
 * Show help text
 */
function showHelp(): void {
  console.log(`
Usage: aligntrue rules <subcommand> [options]

Subcommands:
  list          List all rules

Options for 'list':
  --by-agent    Group rules by which agents receive them
  --json        Output in JSON format

Examples:
  aligntrue rules list
  aligntrue rules list --by-agent
  aligntrue rules list --json

Description:
  View and analyze your rules in .aligntrue/rules/.
  
  The --by-agent flag shows which rules each configured agent
  will receive, based on export_only_to and exclude_from
  frontmatter settings.

Related:
  See https://aligntrue.ai/docs/02-customization/per-rule-targeting
  for documentation on targeting rules to specific agents.
`);
}
