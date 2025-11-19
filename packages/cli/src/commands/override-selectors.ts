/**
 * Command: aligntrue override selectors
 * Lists available selectors for overlays to help authors target rules reliably
 */

import { existsSync, readFileSync } from "fs";
import { parseYamlToJson } from "@aligntrue/schema";
import { ensureSectionsArray } from "@aligntrue/core";
import type { AlignPack } from "@aligntrue/schema";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";

const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--rules",
    hasValue: true,
    description: "Path to rules file (default: .aligntrue/.rules.yaml)",
  },
  {
    flag: "--limit",
    hasValue: true,
    description: "Limit number of sections listed (default: 20, use 0 for all)",
  },
];

export async function overrideSelectors(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help) {
    showStandardHelp({
      name: "override selectors",
      description: "List available selectors for overlays",
      usage: "aligntrue override selectors [--rules path] [--limit N]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue override selectors",
        "aligntrue override selectors --limit 10",
        "aligntrue override selectors --rules bundles/team.rules.yaml",
      ],
      notes: [
        "Use this command to discover available selectors before running 'override add'.",
        "Each section shows both index-based and rule[id=...] selectors (when fingerprints exist).",
        "Selectors are derived from .aligntrue/.rules.yaml (IR).",
      ],
    });
    return;
  }

  const rulesPath =
    (parsed.flags["rules"] as string | undefined) || ".aligntrue/.rules.yaml";
  const limitFlag = parsed.flags["limit"] as string | undefined;
  const limit =
    limitFlag === undefined
      ? 20
      : Math.max(0, Number.parseInt(limitFlag, 10) || 0);

  if (!existsSync(rulesPath)) {
    console.error(`✗ Rules file not found: ${rulesPath}`);
    console.error(
      "  Run 'aligntrue sync' to generate IR before listing selectors.",
    );
    process.exit(1);
  }

  let pack: AlignPack;
  try {
    const content = readFileSync(rulesPath, "utf-8");
    const parsedYaml = parseYamlToJson(content);
    pack = parsedYaml as AlignPack;
    ensureSectionsArray(pack);
  } catch (err) {
    console.error("✗ Failed to read rules file");
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const sections = pack.sections || [];
  console.log(`Selector inventory (${rulesPath})`);
  console.log(
    `Found ${sections.length} section${
      sections.length === 1 ? "" : "s"
    }. Use these selectors in overlays:\n`,
  );

  const rows = limit === 0 ? sections : sections.slice(0, Math.max(limit, 0));

  if (rows.length === 0) {
    console.log("No sections detected. Run 'aligntrue sync' to generate IR.");
    return;
  }

  rows.forEach((section, index) => {
    const heading =
      (section?.heading ? section.heading : "(no heading)") ?? "(no heading)";
    const fingerprint =
      section?.fingerprint && section.fingerprint.length > 0
        ? section.fingerprint
        : "(no fingerprint)";

    const selectorIndex = `sections[${index}]`;
    const headingSelector =
      section?.heading && section.heading.length > 0
        ? `sections[heading=${section.heading}]`
        : undefined;
    const ruleSelector =
      fingerprint !== "(no fingerprint)"
        ? `rule[id=${fingerprint}]`
        : undefined;

    console.log(`${String(index + 1).padStart(3)}. ${heading}`);
    console.log(`     • ${selectorIndex}`);
    if (headingSelector) {
      console.log(`     • ${headingSelector}`);
    }
    if (ruleSelector) {
      console.log(`     • ${ruleSelector}`);
    } else {
      console.log(
        "     • rule[id=…]  (fingerprint missing — use sections[index])",
      );
    }
    const contentPreview =
      section?.content && section.content.trim().split("\n")[0];
    if (contentPreview && contentPreview.length > 0) {
      console.log(`       ${truncate(contentPreview, 80)}`);
    }
    console.log("");
  });

  if (limit > 0 && sections.length > limit) {
    console.log(
      `Showing first ${limit} section${
        limit === 1 ? "" : "s"
      }. Use --limit 0 to display all.`,
    );
  }

  const topLevelKeys = Object.keys(pack)
    .filter((key) => key !== "sections" && key !== "rules")
    .sort();

  if (topLevelKeys.length > 0) {
    console.log("Top-level property selectors:\n");
    topLevelKeys.forEach((key) => {
      console.log(`  • ${key}`);
    });
    console.log(
      "\nUse dot notation for nested properties (e.g., profile.version).",
    );
  }

  console.log(
    "\nTip: Run 'aligntrue override add --selector <value>' using selectors above.",
  );
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
