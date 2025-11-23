import { globSync } from "glob";
import { join } from "path";
import { writeFileSync, mkdirSync } from "fs";

const cwd = "/tmp/test-glob";
mkdirSync(cwd, { recursive: true });
writeFileSync(join(cwd, "AGENTS.md"), "content");

const files = globSync("AGENTS.md", { cwd });
console.log("Files:", files);
