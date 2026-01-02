import fs from "node:fs";
import path from "node:path";

const blocksDir = path.join(process.cwd(), "src", "blocks");
const entries = fs
  .readdirSync(blocksDir, { withFileTypes: true })
  .filter((d) => d.isDirectory());

let ok = true;

for (const dirent of entries) {
  const manifestPath = path.join(blocksDir, dirent.name, "manifest.ts");
  if (!fs.existsSync(manifestPath)) continue;
  const content = fs.readFileSync(manifestPath, "utf8");
  if (!content.includes("draft-07")) {
    console.error(
      `[validate-manifests] ${manifestPath} missing draft-07 schema reference`,
    );
    ok = false;
  }
}

if (!ok) {
  process.exit(1);
}

console.log("[validate-manifests] draft-07 check passed");
