export interface RedactionConfig {
  patterns: RegExp[];
  replacement: string;
  max_summary_length: number;
}

export const DEFAULT_REDACTION: RedactionConfig = {
  patterns: [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // emails
    /\b(ghp_|gho_|github_pat_)[A-Za-z0-9_]+\b/g, // GitHub tokens
    /\b(sk-|pk_)[A-Za-z0-9]+\b/g, // API keys
    /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, // bearer tokens
  ],
  replacement: "[REDACTED]",
  max_summary_length: 500,
};

export function redactString(
  input: string,
  config: RedactionConfig = DEFAULT_REDACTION,
): string {
  let output = input;
  for (const pattern of config.patterns) {
    output = output.replace(pattern, config.replacement);
  }
  if (output.length > config.max_summary_length) {
    output = `${output.slice(0, config.max_summary_length)}…`;
  }
  return output;
}

export function summarizeToolArgs(
  args: unknown,
  config: RedactionConfig = DEFAULT_REDACTION,
): string {
  try {
    const text = typeof args === "string" ? args : JSON.stringify(args);
    return redactString(text, config);
  } catch {
    return config.replacement;
  }
}

export function summarizeToolResult(
  result: unknown,
  config: RedactionConfig = DEFAULT_REDACTION,
): string {
  try {
    const text = typeof result === "string" ? result : JSON.stringify(result);
    return redactString(text, config);
  } catch {
    return config.replacement;
  }
}
