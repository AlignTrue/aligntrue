/**
 * Reusable test environment utilities
 * Provides helpers for creating hermetic test environments and running CLI commands
 */

import { mkdirSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync, ExecSyncOptions } from "child_process";

export interface TestEnvOptions {
  /** Base directory for test (defaults to temp-test-{timestamp}) */
  baseDir?: string;
  /** Whether to clean up on creation (default: true) */
  cleanOnCreate?: boolean;
}

export interface CLIRunOptions {
  /** Working directory (defaults to test env directory) */
  cwd?: string;
  /** Whether to capture output (default: true) */
  captureOutput?: boolean;
  /** Whether to throw on non-zero exit (default: false) */
  throwOnError?: boolean;
  /** Additional environment variables */
  env?: Record<string, string>;
}

export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

/**
 * Create a hermetic test environment
 */
export function createHermeticTestEnv(options: TestEnvOptions = {}): TestEnv {
  const baseDir =
    options.baseDir || join(__dirname, `../../../temp-test-${Date.now()}`);
  const cleanOnCreate = options.cleanOnCreate ?? true;

  if (cleanOnCreate && existsSync(baseDir)) {
    rmSync(baseDir, { recursive: true, force: true });
  }

  mkdirSync(baseDir, { recursive: true });

  return new TestEnv(baseDir);
}

/**
 * Test environment class
 * Provides helpers for setting up and tearing down test environments
 */
export class TestEnv {
  constructor(public readonly dir: string) {}

  /**
   * Get path relative to test directory
   */
  path(...segments: string[]): string {
    return join(this.dir, ...segments);
  }

  /**
   * Create a directory in the test environment
   */
  mkdir(...segments: string[]): string {
    const dirPath = this.path(...segments);
    mkdirSync(dirPath, { recursive: true });
    return dirPath;
  }

  /**
   * Write a file in the test environment
   */
  writeFile(relativePath: string, content: string): string {
    const filePath = this.path(relativePath);
    const dir = join(filePath, "..");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, content, "utf-8");
    return filePath;
  }

  /**
   * Create a minimal valid config
   */
  createConfig(exporters: string[] = ["agents"]): string {
    this.mkdir(".aligntrue");
    return this.writeFile(
      ".aligntrue/config.yaml",
      `exporters:\n${exporters.map((e) => `  - ${e}`).join("\n")}\n`,
    );
  }

  /**
   * Create a minimal valid IR (rules directory with markdown files)
   */
  createIR(
    sections: Array<{ heading: string; content: string; level?: number }> = [],
  ): string {
    this.mkdir(".aligntrue/rules");

    const defaultSections =
      sections.length > 0
        ? sections
        : [{ heading: "Test Section", content: "Test content.", level: 2 }];

    // Write each section as a separate markdown file
    for (const section of defaultSections) {
      const filename =
        section.heading
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") + ".md";
      const level = section.level || 2;
      const content = `${"#".repeat(level)} ${section.heading}\n\n${section.content}\n`;
      this.writeFile(`.aligntrue/rules/${filename}`, content);
    }

    return this.path(".aligntrue/rules");
  }

  /**
   * Create a complete test setup (config + IR)
   */
  createSetup(
    options: {
      exporters?: string[];
      sections?: Array<{ heading: string; content: string; level?: number }>;
    } = {},
  ): void {
    this.createConfig(options.exporters);
    this.createIR(options.sections);
  }

  /**
   * Run a CLI command in this test environment
   */
  runCLI(args: string, options: CLIRunOptions = {}): CLIResult {
    const cliPath = join(__dirname, "../../dist/index.js");
    const cwd = options.cwd || this.dir;
    const captureOutput = options.captureOutput ?? true;
    const throwOnError = options.throwOnError ?? false;

    const execOptions: ExecSyncOptions = {
      cwd,
      encoding: "utf-8",
      stdio: captureOutput ? "pipe" : "inherit",
      env: { ...process.env, ...options.env },
    };

    try {
      // Use shell form with proper quoting to avoid injection vulnerabilities
      // Quote the CLI path to handle spaces, then safely append arguments
      const output = execSync(
        `node ${JSON.stringify(cliPath)} ${args}`,
        execOptions,
      );
      const stdout = captureOutput ? String(output) : "";

      return {
        stdout,
        stderr: "",
        exitCode: 0,
        success: true,
      };
    } catch (error: unknown) {
      if (throwOnError) {
        throw error;
      }

      return {
        stdout: error.stdout ? String(error.stdout) : "",
        stderr: error.stderr ? String(error.stderr) : "",
        exitCode: error.status || 1,
        success: false,
      };
    }
  }

  /**
   * Check if a file exists in the test environment
   */
  exists(...segments: string[]): boolean {
    return existsSync(this.path(...segments));
  }

  /**
   * Clean up the test environment
   */
  cleanup(): void {
    if (existsSync(this.dir)) {
      rmSync(this.dir, { recursive: true, force: true });
    }
  }
}

/**
 * Assert exit code matches expected value
 */
export function assertExitCode(
  actual: number,
  expected: number,
  message?: string,
): void {
  if (actual !== expected) {
    const msg = message || `Expected exit code ${expected}, got ${actual}`;
    throw new Error(msg);
  }
}

/**
 * Assert CLI command succeeds
 */
export function assertSuccess(result: CLIResult, message?: string): void {
  if (!result.success) {
    const msg =
      message ||
      `Command failed with exit code ${result.exitCode}\nstderr: ${result.stderr}`;
    throw new Error(msg);
  }
}

/**
 * Assert CLI command fails
 */
export function assertFailure(result: CLIResult, message?: string): void {
  if (result.success) {
    const msg = message || "Expected command to fail, but it succeeded";
    throw new Error(msg);
  }
}

/**
 * Assert output contains expected string
 */
export function assertOutputContains(
  result: CLIResult,
  expected: string,
  message?: string,
): void {
  const output = result.stdout + result.stderr;
  if (!output.includes(expected)) {
    const msg =
      message ||
      `Expected output to contain "${expected}"\nActual output: ${output}`;
    throw new Error(msg);
  }
}
