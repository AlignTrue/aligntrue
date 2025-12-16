import { parseFrontmatter } from "./convert";

export type RuleSettings = {
  appliesTo: string | null;
  activation: string | null;
  scope: string | null;
};

function normalizeGlobs(globs: unknown): string[] {
  if (!Array.isArray(globs)) return [];
  return globs
    .map((g) => (typeof g === "string" ? g : String(g)))
    .filter((g) => g.trim() !== "");
}

export function humanizeGlobs(globs: string[]): string | null {
  if (!globs.length) return null;
  if (globs.length === 1) return globs[0];
  return globs.join(", ");
}

export function stripFrontmatter(content: string): string {
  const parsed = parseFrontmatter(content);
  return parsed.body.trimStart();
}

function deriveActivation(
  applyTo: unknown,
  alwaysApply: unknown,
): string | null {
  if (alwaysApply === false) return "Manual activation";
  if (alwaysApply === true) return "Always active";
  if (applyTo === "agent_requested") return "Manual activation";
  if (applyTo === "alwaysOn") return "Always active";
  return null;
}

export function extractRuleSettings(content: string): RuleSettings {
  const { data } = parseFrontmatter(content);

  const globs = normalizeGlobs((data as Record<string, unknown>)?.globs);
  const appliesTo = humanizeGlobs(globs);

  const activation = deriveActivation(
    (data as Record<string, unknown>)?.apply_to,
    (data as Record<string, unknown>)?.alwaysApply,
  );

  const scopeValue = (data as Record<string, unknown>)?.scope;
  const scope =
    typeof scopeValue === "string" && scopeValue.trim()
      ? scopeValue.trim()
      : null;

  return {
    appliesTo,
    activation,
    scope,
  };
}
