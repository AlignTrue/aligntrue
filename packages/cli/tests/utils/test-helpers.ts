/**
 * Shared test utilities for CLI command tests
 * Phase 3.5, Session 11
 */

import { vi } from "vitest";
import * as clack from "@clack/prompts";

/**
 * Standard mock setup for CLI commands
 * Provides consistent mocking of console, clack, and process.exit
 */
export function setupStandardMocks() {
  const mockExit = vi
    .spyOn(process, "exit")
    .mockImplementation((() => {}) as any);
  const mockLog = vi.spyOn(console, "log").mockImplementation(() => {});
  const mockError = vi.spyOn(console, "error").mockImplementation(() => {});

  // Mock clack prompts
  vi.mocked(clack.log.error).mockImplementation(() => {});
  vi.mocked(clack.log.warn).mockImplementation(() => {});
  vi.mocked(clack.log.info).mockImplementation(() => {});
  vi.mocked(clack.log.success).mockImplementation(() => {});
  vi.mocked(clack.cancel).mockImplementation(() => {});

  return { mockExit, mockLog, mockError };
}

/**
 * Extract JSON output from console.log calls
 * Finds the first JSON object in combined output
 */
export function extractJsonOutput(logCalls: any[][]): any | null {
  const output = logCalls.map((call) => call.join(" ")).join("\n");
  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

/**
 * Get combined console output as single string
 */
export function getCombinedOutput(logCalls: any[][]): string {
  return logCalls.map((call) => call.join(" ")).join("\n");
}

/**
 * Standard mock for @aligntrue/core module
 * Returns mocks for common core functions
 */
export function mockCoreModule() {
  return {
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
    loadIR: vi.fn(() => ({ rules: [] })),
    evaluateSelector: vi.fn(() => []),
    validateSelector: vi.fn(() => ({ valid: true })),
    parseSelector: vi.fn((sel: string) => ({ type: "rule", value: sel })),
    applyOverlays: vi.fn(() => ({ success: true, appliedCount: 0 })),
    getAlignTruePaths: vi.fn((cwd = process.cwd()) => ({
      config: `${cwd}/.aligntrue/config.yaml`,
      rules: `${cwd}/.aligntrue/rules.md`,
      lockfile: `${cwd}/.aligntrue.lock.json`,
      bundle: `${cwd}/.aligntrue.bundle.yaml`,
      aligntrueDir: `${cwd}/.aligntrue`,
    })),
  };
}
