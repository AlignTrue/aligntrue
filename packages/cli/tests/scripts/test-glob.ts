import { globSync } from "glob";
import { join } from "path";
import { writeFileSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";

const cwd = mkdtempSync(join(tmpdir(), "test-glob-"));
try {
  writeFileSync(join(cwd, "AGENTS.md"), "content");

  const files = globSync("AGENTS.md", { cwd });
  console.log("Files:", files);
} finally {
  rmSync(cwd, { recursive: true, force: true });
}
