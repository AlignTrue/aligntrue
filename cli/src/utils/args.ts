export type ArgType = "string" | "boolean";

export interface ArgDefinition {
  flag: string;
  type: ArgType;
  alias?: string;
  required?: boolean;
  choices?: string[];
}

export interface ParsedArgs {
  flags: Record<string, string | boolean | undefined>;
  positional: string[];
  errors: string[];
}

export function parseArgs(
  input: string[],
  definitions: ArgDefinition[],
): ParsedArgs {
  const flagsMap = new Map<string, string | boolean | undefined>();
  const positional: string[] = [];
  const errors: string[] = [];

  const lookup = new Map<string, ArgDefinition>();
  for (const def of definitions) {
    lookup.set(`--${def.flag}`, def);
    if (def.alias) {
      lookup.set(`-${def.alias}`, def);
    }
  }

  let i = 0;
  while (i < input.length) {
    const token = input.at(i);
    if (!token) break;

    const def = lookup.get(token);
    if (!def) {
      if (token.startsWith("-")) {
        errors.push(`Unknown flag: ${token}`);
      } else {
        positional.push(token);
      }
      i++;
      continue;
    }

    if (def.type === "boolean") {
      flagsMap.set(def.flag, true);
      i++;
      continue;
    }

    const next = input.at(i + 1);
    if (!next || next.startsWith("-")) {
      errors.push(`Flag ${token} requires a value`);
      i++;
      continue;
    }
    flagsMap.set(def.flag, next);
    i += 2;

    if (def.choices && !def.choices.includes(next)) {
      errors.push(`Flag ${token} must be one of: ${def.choices.join(", ")}`);
    }
  }

  for (const def of definitions) {
    const val = flagsMap.get(def.flag);
    if (def.required && !val) {
      errors.push(`Missing required flag: --${def.flag}`);
    }
  }

  return { flags: Object.fromEntries(flagsMap), positional, errors };
}
