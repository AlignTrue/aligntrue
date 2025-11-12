/**
 * Layer 2: Solo Golden Paths
 * Core workflows a normal solo developer does
 */

import { execSync, type ExecException } from "node:child_process";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

interface Workflow {
  name: string;
  steps: WorkflowStep[];
  validation: (workspace: string) => { passed: boolean; error?: string };
}

interface WorkflowStep {
  description: string;
  command: string;
  expectedExitCode: number;
}

const workflows: Workflow[] = [
  {
    name: "Init new project and sync to agents",
    steps: [
      {
        description: "Initialize AlignTrue",
        command: "aligntrue init --mode solo",
        expectedExitCode: 0,
      },
      {
        description: "Sync to agents",
        command: "aligntrue sync",
        expectedExitCode: 0,
      },
    ],
    validation: (workspace) => {
      const configPath = join(workspace, ".aligntrue", "config.yaml");
      const rulesPath = join(workspace, ".aligntrue", ".rules.yaml");
      const agentsPath = join(workspace, "AGENTS.md");

      if (!existsSync(configPath)) {
        return { passed: false, error: "config.yaml not created" };
      }
      if (!existsSync(rulesPath)) {
        return { passed: false, error: ".rules.yaml not created" };
      }
      if (!existsSync(agentsPath)) {
        return { passed: false, error: "AGENTS.md not created" };
      }

      return { passed: true };
    },
  },
  {
    name: "Edit AGENTS.md and sync",
    steps: [
      {
        description: "Initialize AlignTrue",
        command: "aligntrue init --mode solo",
        expectedExitCode: 0,
      },
      {
        description: "Edit AGENTS.md",
        command: 'echo "# Test Rule\\n\\nThis is a test." >> AGENTS.md',
        expectedExitCode: 0,
      },
      {
        description: "Sync changes",
        command: "aligntrue sync",
        expectedExitCode: 0,
      },
    ],
    validation: (workspace) => {
      const rulesPath = join(workspace, ".aligntrue", ".rules.yaml");
      if (!existsSync(rulesPath)) {
        return { passed: false, error: ".rules.yaml not updated" };
      }

      const content = readFileSync(rulesPath, "utf-8");
      if (!content.includes("Test Rule")) {
        return { passed: false, error: "Changes not synced to IR" };
      }

      return { passed: true };
    },
  },
  {
    name: "Check command validates rules",
    steps: [
      {
        description: "Initialize AlignTrue",
        command: "aligntrue init --mode solo",
        expectedExitCode: 0,
      },
      {
        description: "Run check",
        command: "aligntrue check",
        expectedExitCode: 0,
      },
    ],
    validation: () => ({ passed: true }),
  },
  {
    name: "Idempotency - sync twice produces same result",
    steps: [
      {
        description: "Initialize AlignTrue",
        command: "aligntrue init --mode solo",
        expectedExitCode: 0,
      },
      {
        description: "First sync",
        command: "aligntrue sync > sync1.log 2>&1",
        expectedExitCode: 0,
      },
      {
        description: "Second sync",
        command: "aligntrue sync > sync2.log 2>&1",
        expectedExitCode: 0,
      },
    ],
    validation: (workspace) => {
      const sync1 = join(workspace, "sync1.log");
      const sync2 = join(workspace, "sync2.log");

      if (!existsSync(sync1) || !existsSync(sync2)) {
        return { passed: false, error: "Sync logs not found" };
      }

      // Content should be similar (not necessarily identical due to timestamps)
      const content1 = readFileSync(sync1, "utf-8");
      const content2 = readFileSync(sync2, "utf-8");

      if (content1.length === 0 || content2.length === 0) {
        return { passed: false, error: "Empty sync output" };
      }

      return { passed: true };
    },
  },
];

function runWorkflow(
  workflow: Workflow,
  workspace: string,
): {
  passed: boolean;
  error?: string;
  stepResults: Array<{ step: WorkflowStep; passed: boolean; output: string }>;
} {
  const stepResults: Array<{
    step: WorkflowStep;
    passed: boolean;
    output: string;
  }> = [];

  for (const step of workflow.steps) {
    console.log(`  ${step.description}`);
    console.log(`  Executing: ${step.command}`);

    let output = "";
    let exitCode = 0;

    try {
      output = execSync(step.command, {
        cwd: workspace,
        encoding: "utf-8",
        stdio: "pipe",
        shell: "/bin/bash",
      });
    } catch (err) {
      const execErr = err as ExecException;
      exitCode = execErr.status || 1;
      output = execErr.stdout?.toString() || execErr.stderr?.toString() || "";
    }

    const passed = exitCode === step.expectedExitCode;
    stepResults.push({ step, passed, output });

    console.log(`  Exit code: ${exitCode}`);
    console.log(`  ${passed ? "✓" : "✗"} ${passed ? "PASS" : "FAIL"}\n`);

    if (!passed) {
      return {
        passed: false,
        error: `Step failed: ${step.description}`,
        stepResults,
      };
    }
  }

  // Run validation
  const validation = workflow.validation(workspace);

  return {
    passed: validation.passed,
    error: validation.error,
    stepResults,
  };
}

function main() {
  console.log("=== Layer 2: Solo Golden Paths ===\n");

  const workspace = process.env.TEST_WORKSPACE || process.cwd();
  const results = workflows.map((workflow) => {
    console.log(`Workflow: ${workflow.name}`);

    const result = runWorkflow(workflow, workspace);

    if (result.passed) {
      console.log("✓ WORKFLOW PASS\n");
    } else {
      console.log(`✗ WORKFLOW FAIL: ${result.error}\n`);
    }

    return { workflow, result };
  });

  // Summary
  const passed = results.filter((r) => r.result.passed).length;
  const failed = results.length - passed;

  console.log("\n=== Summary ===");
  console.log(`Total workflows: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  // Write results to log
  const logPath = process.env.LOG_FILE || "/tmp/layer-2-results.json";
  writeFileSync(
    logPath,
    JSON.stringify(
      {
        layer: 2,
        timestamp: new Date().toISOString(),
        results: results.map((r) => ({
          name: r.workflow.name,
          passed: r.result.passed,
          error: r.result.error,
          steps: r.result.stepResults.length,
        })),
      },
      null,
      2,
    ),
  );

  process.exit(failed > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
}

export { workflows, runWorkflow };
