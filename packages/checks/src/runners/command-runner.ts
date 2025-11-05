/**
 * Command runner check
 */

import { spawn } from "child_process";
import type { AlignRule } from "@aligntrue/schema";
import type { CheckResult, CheckContext } from "../types.js";
import { hasCheck } from "../types.js";

/**
 * Run command_runner check
 *
 * Executes a shell command and validates exit code.
 * REQUIRES explicit allowExec=true in execution config.
 */
export async function runCommandRunnerCheck(
  rule: AlignRule,
  packId: string,
  context: CheckContext,
): Promise<CheckResult> {
  const { executionConfig, workingDir } = context;

  if (!hasCheck(rule)) {
    return {
      rule,
      packId,
      pass: false,
      findings: [],
      error: "Rule does not have a check property",
    };
  }

  const { inputs, evidence = "Check failed" } = rule.check;

  if (rule.check.type !== "command_runner") {
    return {
      rule,
      packId,
      pass: false,
      findings: [],
      error: "Check type mismatch: expected command_runner",
    };
  }

  const command = inputs["command"] as string;
  const commandWorkingDir =
    (inputs["working_dir"] as string | undefined) || workingDir;
  const timeoutMs =
    (inputs["timeout_ms"] as number | undefined) ||
    executionConfig.defaultTimeout ||
    30000;
  const expectExitCode =
    (inputs["expect_exit_code"] as number | undefined) ?? 0;

  // Check if execution is allowed
  if (!executionConfig.allowExec) {
    return {
      rule,
      packId,
      pass: false,
      findings: [
        {
          packId,
          ruleId: rule.id,
          severity: rule.severity,
          evidence,
          message: `Command execution not allowed: "${command}" (use --allow-exec to enable)`,
          location: { path: "." },
          ...(rule.autofix?.hint && { autofixHint: rule.autofix.hint }),
        },
      ],
    };
  }

  try {
    const exitCode = await executeCommand(
      command,
      commandWorkingDir,
      timeoutMs,
      executionConfig.envWhitelist,
    );

    if (exitCode === expectExitCode) {
      return {
        rule,
        packId,
        pass: true,
        findings: [],
      };
    }

    return {
      rule,
      packId,
      pass: false,
      findings: [
        {
          packId,
          ruleId: rule.id,
          severity: rule.severity,
          evidence,
          message: `${evidence}: command "${command}" exited with code ${exitCode} (expected ${expectExitCode})`,
          location: { path: "." },
          ...(rule.autofix?.hint && { autofixHint: rule.autofix.hint }),
        },
      ],
    };
  } catch (_err) {
    return {
      rule,
      packId,
      pass: false,
      findings: [],
      error: _err instanceof Error ? _err.message : "Unknown error",
    };
  }
}

/**
 * Execute a shell command with timeout and environment whitelist
 */
function executeCommand(
  command: string,
  cwd: string,
  timeoutMs: number,
  envWhitelist?: string[],
): Promise<number> {
  return new Promise((resolve, reject) => {
    // Build environment with only whitelisted variables
    const env: Record<string, string> = {};
    if (envWhitelist && envWhitelist.length > 0) {
      for (const key of envWhitelist) {
        if (process.env[key]) {
          env[key] = process.env[key]!;
        }
      }
    } else {
      // If no whitelist, pass through current environment
      Object.assign(env, process.env);
    }

    const child = spawn(command, {
      cwd,
      env,
      shell: true,
      stdio: "pipe",
    });

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000);
    }, timeoutMs);

    child.on("exit", (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
      } else {
        resolve(code ?? 1);
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}
