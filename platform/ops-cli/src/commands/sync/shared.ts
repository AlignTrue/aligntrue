import {
  loadTokenSet,
  withTokenRefresh,
} from "@aligntrue/ops-shared-google-common";
import { exitWithError } from "../../utils/command-utilities.js";

export function logSection(title: string): void {
  console.log(title);
}

export function logKV(label: string, value: string | number): void {
  console.log(`  ${label}: ${value}`);
}

export function parseDaysArg(args: string[], defaultValue: number): number {
  const daysArg = args.find((a) => a.startsWith("--days="));
  if (!daysArg) return defaultValue;

  const parsed = Number.parseInt(daysArg.split("=")[1] ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    exitWithError(2, "Invalid --days value: expected positive integer");
  }
  return parsed;
}

/**
 * Re-export helper to run an operation with automatic refresh + retry on 401.
 */
export { loadTokenSet, withTokenRefresh };
