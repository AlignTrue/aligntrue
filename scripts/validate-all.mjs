#!/usr/bin/env node
import { spawnSync } from "child_process";

const validators = [
  {
    name: "Workspace protocol",
    script: "validate-workspace-protocol.mjs",
    hint: 'Ensure @aligntrue/* dependencies use "workspace:*" in package.json.',
  },
  {
    name: "UI tsconfig",
    script: "validate-ui-tsconfig.mjs",
    hint: "Check apps/app and packages/ui tsconfig paths for mismatches.",
  },
  {
    name: "Transpile packages",
    script: "validate-transpile-packages.mjs",
    hint: "Verify pnpm-workspace and turbo filters allow building packages.",
  },
];

let failed = false;

for (const { name, script, hint } of validators) {
  console.log(`\n▶ Running ${name}...`);
  const result = spawnSync("node", [`scripts/${script}`], { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`✗ ${name} failed`);
    if (hint) {
      console.error(`  Hint: ${hint}`);
    }
    failed = true;
  } else {
    console.log(`✓ ${name} passed`);
  }
}

process.exit(failed ? 1 : 0);
