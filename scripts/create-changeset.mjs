#!/usr/bin/env node
/**
 * Smart changeset creation script
 * Auto-detects changed packages and generates changesets with AI-assisted bump recommendations
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import * as clack from "@clack/prompts";

// ANSI colors
const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
};

function run(cmd, options = {}) {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      stdio: options.silent ? "pipe" : "inherit",
      ...options,
    }).trim();
  } catch (error) {
    if (options.ignoreError) return "";
    throw error;
  }
}

function getLatestReleaseTag() {
  const tag = run("git describe --tags --abbrev=0", {
    silent: true,
    ignoreError: true,
  });
  if (!tag) {
    clack.log.error("No release tags found. Has a release been published?");
    process.exit(1);
  }
  return tag;
}

function getChangedPackages(tag) {
  const changedFiles = run(`git diff --name-only ${tag}..HEAD -- packages/*/`, {
    silent: true,
  }).split("\n");

  // Extract unique package names
  const packages = new Set();
  for (const file of changedFiles) {
    if (!file) continue;
    const match = file.match(/^packages\/([^/]+)\//);
    if (match) {
      packages.add(match[1]);
    }
  }

  // Read ignored packages from changeset config
  const configPath = join(process.cwd(), ".changeset", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const ignored = new Set(
    (config.ignore || []).map((name) => name.replace("@aligntrue/", "")),
  );

  // Read package.json to get full package names
  const packageNames = [];
  for (const pkg of packages) {
    if (ignored.has(pkg)) continue;

    try {
      const pkgJsonPath = join(process.cwd(), "packages", pkg, "package.json");
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
      if (!pkgJson.private) {
        packageNames.push(pkgJson.name);
      }
    } catch (error) {
      // Skip if package.json doesn't exist or is malformed
    }
  }

  return packageNames;
}

function analyzeCommits(tag) {
  const commits = run(`git log ${tag}..HEAD --oneline`, {
    silent: true,
  }).split("\n");

  const analysis = {
    total: commits.filter((c) => c).length,
    feat: 0,
    fix: 0,
    breaking: 0,
    other: 0,
    messages: [],
  };

  for (const commit of commits) {
    if (!commit) continue;

    const message = commit.replace(/^[a-f0-9]+ /, "");
    analysis.messages.push(message);

    if (message.includes("BREAKING CHANGE") || message.match(/!:/)) {
      analysis.breaking++;
    } else if (message.startsWith("feat:") || message.startsWith("feat(")) {
      analysis.feat++;
    } else if (message.startsWith("fix:") || message.startsWith("fix(")) {
      analysis.fix++;
    } else {
      analysis.other++;
    }
  }

  return analysis;
}

function recommendBump(analysis) {
  if (analysis.breaking > 0) return "major";
  if (analysis.feat > 0) return "minor";
  return "patch";
}

function formatBumpGuidance(currentVersion, bumpType) {
  // Parse current version (e.g., "0.1.1-alpha.4")
  const match = currentVersion.match(/(\d+)\.(\d+)\.(\d+)(?:-(.+))?/);
  if (!match) return "";

  let [, major, minor, patch, prerelease] = match;
  major = parseInt(major);
  minor = parseInt(minor);
  patch = parseInt(patch);

  const preParts = prerelease ? prerelease.split(".") : [];
  const preTag = preParts[0] || "alpha";
  const preNum = preParts[1] ? parseInt(preParts[1]) : 0;

  let next;
  if (bumpType === "major") {
    next = `${major + 1}.0.0-${preTag}.0`;
  } else if (bumpType === "minor") {
    next = `${major}.${minor + 1}.0-${preTag}.0`;
  } else {
    next = `${major}.${minor}.${patch}-${preTag}.${preNum + 1}`;
  }

  return `${currentVersion} → ${next}`;
}

function generateChangelog(analysis) {
  const lines = [];
  const grouped = {
    breaking: [],
    feat: [],
    fix: [],
    other: [],
  };

  for (const msg of analysis.messages) {
    if (msg.includes("BREAKING CHANGE") || msg.match(/!:/)) {
      grouped.breaking.push(msg);
    } else if (msg.startsWith("feat:") || msg.startsWith("feat(")) {
      grouped.feat.push(msg);
    } else if (msg.startsWith("fix:") || msg.startsWith("fix(")) {
      grouped.fix.push(msg);
    } else {
      grouped.other.push(msg);
    }
  }

  if (grouped.breaking.length) {
    lines.push("### Breaking Changes");
    grouped.breaking.forEach((m) => lines.push(`- ${m}`));
    lines.push("");
  }

  if (grouped.feat.length) {
    lines.push("### Features");
    grouped.feat.slice(0, 10).forEach((m) => lines.push(`- ${m}`));
    if (grouped.feat.length > 10) {
      lines.push(`- ...and ${grouped.feat.length - 10} more features`);
    }
    lines.push("");
  }

  if (grouped.fix.length) {
    lines.push("### Fixes");
    grouped.fix.slice(0, 10).forEach((m) => lines.push(`- ${m}`));
    if (grouped.fix.length > 10) {
      lines.push(`- ...and ${grouped.fix.length - 10} more fixes`);
    }
    lines.push("");
  }

  if (grouped.other.length) {
    lines.push("### Other Changes");
    grouped.other.slice(0, 5).forEach((m) => lines.push(`- ${m}`));
    if (grouped.other.length > 5) {
      lines.push(`- ...and ${grouped.other.length - 5} more changes`);
    }
  }

  return lines.join("\n");
}

function createChangesetFile(packages, bumpType, summary) {
  const id = randomBytes(4).toString("hex");
  const changesetPath = join(process.cwd(), ".changeset", `${id}.md`);

  // Quote ALL package names for YAML compatibility
  const frontmatter = packages.map((pkg) => `"${pkg}": ${bumpType}`).join("\n");

  const content = `---
${frontmatter}
---

${summary}
`;

  writeFileSync(changesetPath, content, "utf8");
  return changesetPath;
}

async function main() {
  clack.intro("📦 Smart Changeset Creator");

  // 1. Detect latest tag
  const tag = getLatestReleaseTag();
  clack.log.step(`Latest release: ${colors.cyan}${tag}${colors.reset}`);

  // 2. Find changed packages
  const packages = getChangedPackages(tag);
  if (packages.length === 0) {
    clack.log.warn("No packages have changed since last release.");
    clack.outro("Nothing to do!");
    process.exit(0);
  }

  clack.log.info(
    `Found ${colors.green}${packages.length}${colors.reset} changed packages:`,
  );
  packages.forEach((pkg) =>
    clack.log.message(`  ${colors.dim}•${colors.reset} ${pkg}`),
  );

  // 3. Analyze commits
  const analysis = analyzeCommits(tag);
  const recommended = recommendBump(analysis);

  clack.log.step(
    `Analyzed ${colors.cyan}${analysis.total}${colors.reset} commits since ${tag}:`,
  );
  clack.log.message(
    `  ${colors.green}${analysis.feat}${colors.reset} features, ` +
      `${colors.yellow}${analysis.fix}${colors.reset} fixes, ` +
      `${colors.red}${analysis.breaking}${colors.reset} breaking`,
  );

  // Get current version for guidance
  const firstPkgPath = join(
    process.cwd(),
    "packages",
    packages[0].replace("@aligntrue/", ""),
    "package.json",
  );
  const currentVersion = JSON.parse(readFileSync(firstPkgPath, "utf8")).version;

  // 4. Interactive prompt
  const bumpType = await clack.select({
    message: "What type of bump?",
    options: [
      {
        value: "patch",
        label: "patch",
        hint: `Bug fixes, refactors, docs (${formatBumpGuidance(currentVersion, "patch")})`,
      },
      {
        value: "minor",
        label: "minor",
        hint: `New features (${formatBumpGuidance(currentVersion, "minor")})`,
      },
      {
        value: "major",
        label: "major",
        hint: `Breaking changes (${formatBumpGuidance(currentVersion, "major")})`,
      },
    ],
    initialValue: recommended,
  });

  if (clack.isCancel(bumpType)) {
    clack.cancel("Operation cancelled.");
    process.exit(0);
  }

  clack.log.success(
    `Using ${colors.cyan}${bumpType}${colors.reset} bump${recommended === bumpType ? ` ${colors.dim}(recommended)${colors.reset}` : ""}`,
  );

  // 5. Generate changelog
  const s = clack.spinner();
  s.start("Generating changelog summary...");
  const changelog = generateChangelog(analysis);
  s.stop("Changelog generated");

  // 6. Create changeset file
  const changesetPath = createChangesetFile(packages, bumpType, changelog);
  clack.log.success(
    `Created changeset: ${colors.dim}${changesetPath.replace(process.cwd(), ".")}${colors.reset}`,
  );

  // 7. Next steps
  clack.note(
    `${colors.cyan}git add .changeset/\n` +
      `git commit -m "chore: Add changeset for ${bumpType} release"\n` +
      `git push${colors.reset}`,
    "Next steps",
  );

  clack.outro(
    `✅ Changeset ready! Push to trigger automated release workflow.`,
  );
}

main().catch((error) => {
  clack.log.error(error.message);
  process.exit(1);
});
