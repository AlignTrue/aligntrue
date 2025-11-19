#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const PACKAGES = [
  "aligntrue",
  "@aligntrue/cli",
  "@aligntrue/core",
  "@aligntrue/exporters",
  "@aligntrue/schema",
  "@aligntrue/sources",
  "@aligntrue/file-utils",
  "@aligntrue/plugin-contracts",
  "@aligntrue/testkit"
  // Note: @aligntrue/ui is private and not published
];

console.log("🔍 Post-publish validation: checking npm registry\n");
console.log("Waiting 5s for npm registry to update...");

await new Promise(resolve => setTimeout(resolve, 5000));

for (const pkg of PACKAGES) {
  const result = spawnSync(
    "npm",
    ["view", `${pkg}@latest`, "dependencies", "--json"],
    { encoding: "utf8" }
  );
  
  if (result.status !== 0) {
    console.error(`❌ Failed to fetch ${pkg} from npm`);
    process.exit(1);
  }
  
  const deps = JSON.parse(result.stdout || "{}");
  
  for (const [name, version] of Object.entries(deps)) {
    if (version.includes("workspace:")) {
      console.error(`❌ ${pkg} has workspace leak: ${name}: ${version}`);
      process.exit(1);
    }
  }
  
  console.log(`✓ ${pkg}`);
}

console.log("\n✅ All published packages validated");

