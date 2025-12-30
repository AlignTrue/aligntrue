export type LayoutTemplateId = "single" | "split" | "dashboard" | "inbox";

export interface LayoutTemplate {
  readonly slots: readonly string[];
  readonly grid?: string;
}

/**
 * Deterministic layout templates with named slots.
 */
export const LAYOUT_TEMPLATES: Record<LayoutTemplateId, LayoutTemplate> = {
  single: { slots: ["main"] },
  split: { slots: ["primary", "secondary"], grid: "2fr 1fr" },
  dashboard: { slots: ["header", "main", "sidebar"], grid: "auto 1fr 280px" },
  inbox: {
    slots: ["nav", "list", "detail", "actions"],
    grid: "1fr 320px 1fr auto",
  },
};

export function validateLayoutTemplate(
  template: string,
): template is LayoutTemplateId {
  return template in LAYOUT_TEMPLATES;
}
