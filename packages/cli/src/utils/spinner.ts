import * as clack from "@clack/prompts";

const isInteractive = Boolean(process.stdout.isTTY && process.stderr.isTTY);

type ClackSpinner = ReturnType<typeof clack.spinner>;

class NoopSpinner {
  start(message?: string): void {
    if (message) {
      console.log(message);
    }
  }

  stop(message?: string): void {
    if (message) {
      console.log(message);
    }
  }

  message(text: string): void {
    console.log(text);
  }
}

export type SpinnerLike = ClackSpinner | NoopSpinner;

export function createSpinner(options?: { disabled?: boolean }): SpinnerLike {
  if (options?.disabled || !isInteractive) {
    return new NoopSpinner();
  }
  return clack.spinner();
}

export function isInteractiveTerminal(): boolean {
  return isInteractive;
}
