#!/usr/bin/env node
/**
 * Manual release script for AlignTrue
 * Replaces Changesets with a simple, reliable release process
 */

import { execSync, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";
import * as clack from "@clack/prompts";

// Parse CLI args
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const typeFlag = args.find((arg) => arg.startsWith("--type="));
const nonInteractive = typeFlag !== undefined;
const requestedType = typeFlag?.split("=")[1];

function run(cmd, options = {}) {
  try {
    if (isDryRun && !options.alwaysRun) {
      console.log(`[DRY-RUN] ${cmd}`);
      return "";
    }
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

function getWorkspacePackages() {
  const packagePaths = globSync("packages/*/package.json", {
    cwd: process.cwd(),
  });

  const packages = [];
  for (const pkgPath of packagePaths) {
    const fullPath = join(process.cwd(), pkgPath);
    const pkgJson = JSON.parse(readFileSync(fullPath, "utf8"));

    // Skip private packages and docs/ui
    if (
      pkgJson.private ||
      pkgJson.name === "@aligntrue/docs" ||
      pkgJson.name === "@aligntrue/ui"
    ) {
      continue;
    }

    packages.push({
      name: pkgJson.name,
      version: pkgJson.version,
      path: fullPath,
      pkgJson,
    });
  }

  return packages;
}

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) throw new Error(`Invalid version format: ${version}`);

  const [, major, minor, patch, prerelease] = match;
  const preParts = prerelease ? prerelease.split(".") : [];

  return {
    major: parseInt(major),
    minor: parseInt(minor),
    patch: parseInt(patch),
    preTag: preParts[0] || null,
    preNum: preParts[1] ? parseInt(preParts[1]) : null,
  };
}

function bumpVersion(currentVersion, bumpType) {
  const v = parseVersion(currentVersion);

  if (bumpType === "alpha") {
    // Increment alpha version
    if (v.preTag === "alpha" && v.preNum !== null) {
      return `${v.major}.${v.minor}.${v.patch}-alpha.${v.preNum + 1}`;
    }
    // Start new alpha from current version
    return `${v.major}.${v.minor}.${v.patch}-alpha.0`;
  }

  if (bumpType === "patch") {
    return `${v.major}.${v.minor}.${v.patch + 1}`;
  }

  if (bumpType === "minor") {
    return `${v.major}.${v.minor + 1}.0`;
  }

  if (bumpType === "major") {
    return `${v.major + 1}.0.0`;
  }

  throw new Error(`Unknown bump type: ${bumpType}`);
}

function updatePackageVersion(pkg, newVersion) {
  const pkgJson = { ...pkg.pkgJson };
  pkgJson.version = newVersion;

  if (isDryRun) {
    console.log(
      `[DRY-RUN] Would update ${pkg.name} from ${pkg.version} to ${newVersion}`,
    );
    return;
  }

  writeFileSync(pkg.path, JSON.stringify(pkgJson, null, 2) + "\n", "utf8");
}

function publishPackage(pkg, tag) {
  const dir = pkg.path.replace("/package.json", "");

  if (isDryRun) {
    console.log(
      `[DRY-RUN] Would publish ${pkg.name} with tag: ${tag || "latest"}`,
    );
    return;
  }

  try {
    const args = ["publish"];
    if (tag) {
      args.push("--tag", tag);
    }
    execFileSync("npm", args, {
      cwd: dir,
      stdio: "inherit",
      encoding: "utf8",
    });
  } catch (error) {
    throw error;
  }
}

function gitCommitAndTag(version, bumpType) {
  const message = `chore: Release ${version} (${bumpType})`;
  const tag = `v${version}`;

  if (isDryRun) {
    console.log(`[DRY-RUN] Would commit: ${message}`);
    console.log(`[DRY-RUN] Would create tag: ${tag}`);
    console.log(`[DRY-RUN] Would push to origin`);
    return;
  }

  run("git add .", { silent: false });
  run(`git commit -m "${message}"`, { silent: false });
  run(`git tag ${tag}`, { silent: false });
  run("git push && git push --tags", { silent: false });
}

async function main() {
  clack.intro(
    isDryRun
      ? "📦 Manual Release (DRY RUN)"
      : "📦 Manual Release for AlignTrue",
  );

  // 1. Get all publishable packages
  const packages = getWorkspacePackages();
  if (packages.length === 0) {
    clack.log.error("No publishable packages found");
    process.exit(1);
  }

  clack.log.info(`Found ${packages.length} publishable packages:`);
  packages.forEach((pkg) =>
    clack.log.message(`  • ${pkg.name}@${pkg.version}`),
  );

  // 2. Determine bump type
  let bumpType;
  if (nonInteractive) {
    if (!["alpha", "patch", "minor", "major"].includes(requestedType)) {
      clack.log.error(
        `Invalid bump type: ${requestedType}. Use: alpha, patch, minor, major`,
      );
      process.exit(1);
    }
    bumpType = requestedType;
    clack.log.info(`Using bump type: ${bumpType}`);
  } else {
    const currentVersion = packages[0].version;
    bumpType = await clack.select({
      message: "What type of release?",
      options: [
        {
          value: "alpha",
          label: "alpha",
          hint: `Next alpha (${currentVersion} → ${bumpVersion(currentVersion, "alpha")})`,
        },
        {
          value: "patch",
          label: "patch",
          hint: `Bug fixes (${currentVersion} → ${bumpVersion(currentVersion, "patch")})`,
        },
        {
          value: "minor",
          label: "minor",
          hint: `New features (${currentVersion} → ${bumpVersion(currentVersion, "minor")})`,
        },
        {
          value: "major",
          label: "major",
          hint: `Breaking changes (${currentVersion} → ${bumpVersion(currentVersion, "major")})`,
        },
      ],
      initialValue: "alpha",
    });

    if (clack.isCancel(bumpType)) {
      clack.cancel("Operation cancelled");
      process.exit(0);
    }
  }

  // 3. Calculate new versions
  const updates = packages.map((pkg) => ({
    pkg,
    oldVersion: pkg.version,
    newVersion: bumpVersion(pkg.version, bumpType),
  }));

  clack.log.step("Version changes:");
  updates.forEach(({ pkg, oldVersion, newVersion }) => {
    clack.log.message(`  ${pkg.name}: ${oldVersion} → ${newVersion}`);
  });

  // 4. Confirm (unless non-interactive)
  if (!nonInteractive && !isDryRun) {
    const confirmed = await clack.confirm({
      message: "Proceed with release?",
    });

    if (!confirmed || clack.isCancel(confirmed)) {
      clack.cancel("Operation cancelled");
      process.exit(0);
    }
  }

  // 5. Update package.json files
  const s = clack.spinner();
  s.start("Updating package versions...");
  for (const { pkg, newVersion } of updates) {
    updatePackageVersion(pkg, newVersion);
  }
  s.stop("Package versions updated");

  // 6. Build packages
  s.start("Building packages...");
  try {
    if (isDryRun) {
      console.log("[DRY-RUN] Would run: pnpm build:packages");
    } else {
      run("pnpm build:packages");
    }
    s.stop("Build complete");
  } catch (error) {
    s.stop("Build failed");
    clack.log.error(error.message);
    process.exit(1);
  }

  // 7. Publish to npm
  const npmTag = bumpType === "alpha" ? "alpha" : "latest";
  s.start(`Publishing to npm with tag: ${npmTag}...`);

  for (const { pkg, newVersion } of updates) {
    try {
      publishPackage({ ...pkg, version: newVersion }, npmTag);
    } catch (error) {
      s.stop("Publish failed");
      clack.log.error(`Failed to publish ${pkg.name}: ${error.message}`);
      process.exit(1);
    }
  }
  s.stop(`Published ${packages.length} packages to npm`);

  // 8. Commit and tag
  const firstNewVersion = updates[0].newVersion;
  s.start("Creating git commit and tag...");
  try {
    gitCommitAndTag(firstNewVersion, bumpType);
    s.stop("Git commit and tag created");
  } catch (error) {
    s.stop("Git operations failed");
    clack.log.error(error.message);
    process.exit(1);
  }

  // 9. Success
  clack.outro(
    isDryRun
      ? "✅ Dry run complete! No changes made."
      : `✅ Released ${firstNewVersion} successfully!`,
  );

  if (!isDryRun) {
    clack.note(
      "Next steps:\n" +
        "1. Update CHANGELOG.md with release notes\n" +
        "2. Verify packages on npm: https://www.npmjs.com/package/aligntrue\n" +
        "3. Test the published CLI: npx aligntrue@alpha --version",
      "Post-release checklist",
    );
  }
}

main().catch((error) => {
  clack.log.error(error.message);
  console.error(error);
  process.exit(1);
});
