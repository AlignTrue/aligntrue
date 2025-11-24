import { execSync } from "child_process";
import { resolve, join, dirname } from "path";
import { rmSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = resolve(__dirname, "../../dist/index.js");

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runCli(
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<RunResult> {
  try {
    // Use node to run the CLI with properly quoted path to prevent shell injection
    const quotedPath = JSON.stringify(CLI_PATH);
    const quotedArgs = args.map((a) => JSON.stringify(a)).join(" ");
    const command = `node ${quotedPath} ${quotedArgs}`;

    const stdout = execSync(command, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...options.env,
        NODE_ENV: "test",
        ALIGNTRUE_NO_TELEMETRY: "1",
      },
      encoding: "utf-8",
      stdio: "pipe", // Capture output
    });

    return { stdout, stderr: "", exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout?.toString() || "",
      stderr: error.stderr?.toString() || "",
      exitCode: error.status || 1,
    };
  }
}

export async function createTestDir(prefix: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), `aligntrue-${prefix}-`));
  return dir;
}

export async function cleanupTestDir(dir: string): Promise<void> {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}
