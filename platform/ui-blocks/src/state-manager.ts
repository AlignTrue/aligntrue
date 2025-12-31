import type { UIState } from "@aligntrue/ui-contracts";
import { canonicalize, deterministicId } from "@aligntrue/ui-contracts";

export function initialState(plan_id: string): UIState {
  const content = {
    selections: {},
    form_values: {},
    expanded_sections: [],
  };
  return {
    plan_id,
    version: 1,
    ...content,
    content_hash: computeStateHash(content),
  };
}

export function applyStateUpdate(
  prev: UIState,
  update: Partial<
    Pick<UIState, "selections" | "form_values" | "expanded_sections">
  >,
): UIState {
  const content = {
    selections: update.selections ?? prev.selections,
    form_values: update.form_values ?? prev.form_values,
    expanded_sections: update.expanded_sections ?? prev.expanded_sections,
  };
  return {
    plan_id: prev.plan_id,
    version: prev.version + 1,
    ...content,
    content_hash: computeStateHash(content),
  };
}

function computeStateHash(content: {
  selections: Record<string, unknown>;
  form_values: Record<string, unknown>;
  expanded_sections: string[];
}): string {
  return deterministicId(canonicalize(content));
}
