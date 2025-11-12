/**
 * Enhanced error formatter with actionable fixes
 */

export interface ActionableFix {
  command: string;
  description: string;
  impact: string;
}

export interface ActionableError {
  problem: string;
  context: string[];
  fixes: ActionableFix[];
  learnMoreUrl?: string;
}

/**
 * Format and display an actionable error
 */
export function displayActionableError(error: ActionableError): void {
  console.error("\n✗ Configuration Error: " + error.problem);
  console.error("");

  if (error.context.length > 0) {
    console.error("Context:");
    error.context.forEach((line) => {
      console.error(`  ${line}`);
    });
    console.error("");
  }

  console.error("Fix (choose one):\n");

  error.fixes.forEach((fix, index) => {
    console.error(`${index + 1}. ${fix.description}:`);
    console.error(`   ${fix.command}`);
    console.error("");
    console.error(`   This will:`);
    console.error(`   ${fix.impact}`);
    console.error("");
  });

  if (error.learnMoreUrl) {
    console.error(`Learn more: ${error.learnMoreUrl}`);
    console.error("");
  }
}

/**
 * Create an actionable error
 */
export function createActionableError(
  problem: string,
  context: string[],
  fixes: ActionableFix[],
  learnMoreUrl?: string,
): ActionableError {
  return {
    problem,
    context,
    fixes,
    learnMoreUrl: learnMoreUrl || "",
  };
}
