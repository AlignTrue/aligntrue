import fs from "node:fs";
import path from "node:path";

// This script is run from the 'packages/core' directory via pnpm.
const CWD = process.cwd();

const schemaFile = path.join(CWD, "src/schemas/config.schema.json");
const destDir = path.join(CWD, "dist/schemas");
const destFile = path.join(destDir, "config.schema.json");

if (!fs.existsSync(schemaFile)) {
  console.error(`Schema file not found at ${schemaFile}`);
  process.exit(1);
}

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

fs.copyFileSync(schemaFile, destFile);
console.log(`Copied ${schemaFile} to ${destFile}`);
