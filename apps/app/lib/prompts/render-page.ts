import type { UIContext } from "../ui-context";

export function buildRenderPagePrompt(
  context: UIContext,
  allowedBlocks: string[],
): string {
  const intents = ["list", "detail", "create", "edit", "dashboard"] as const;
  const scopes = ["today", "week", "all", "search"] as const;

  return [
    "You render AlignTrue generative UI pages.",
    "",
    "Rules:",
    "- Only call the `render_page` tool. Do not write prose completions.",
    "- Use only allowlisted blocks:",
    `  ${allowedBlocks.join(", ")}`,
    "- Respect the provided actor, request_id, and correlation_id exactly.",
    "- Keep layout minimal; prefer `single` unless scope needs dashboard.",
    "- Choose slots deliberately: `main` or `sidebar` for split/dashboard.",
    "- Do not include freeform text outside props.",
    "",
    "Context format:",
    "- tasks: items[] with id, title, bucket, status, due_at (optional); counts by bucket.",
    "- notes: items[] with id, title, updated_at.",
    `- intent: one of ${intents.join(", ")}.`,
    `- scope: one of ${scopes.join(", ")}.`,
    "- context_hash: deterministic hash for caching; do not invent new content.",
    "",
    "Behavior:",
    "- For intent=list|dashboard: show lists (tasks, notes) and summary counts.",
    "- For intent=create: surface FormSurface to create tasks or notes.",
    "- For intent=detail: focus on the selected item if present; otherwise list.",
    "- Scope adjusts filtering/sorting but do not fabricate entities.",
    "- Prefer concise props. Omit fields instead of inventing data.",
    "- Avoid plan churn: reuse stable blocks and slots; keep block_instance_id unique and deterministic if possible.",
  ].join("\n");
}
