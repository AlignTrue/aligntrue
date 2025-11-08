import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const exportersDistPath = join(__dirname, "../exporters/dist");

// Verify exporters are built before running tests
if (!existsSync(exportersDistPath)) {
  console.error("\n❌ Error: Exporters package not built\n");
  console.error(`Expected: ${exportersDistPath}\n`);
  console.error("Fix: Run one of these commands:\n");
  console.error(
    "  pnpm build                               # Build all packages",
  );
  console.error(
    "  pnpm --filter @aligntrue/exporters build # Build just exporters\n",
  );
  console.error("Why: CLI tests load exporters from dist/ at runtime\n");
  process.exit(1);
}

console.log("✓ Exporters package found");
