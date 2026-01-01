import { describe, expect, test } from "vitest";
import { computeToggledPolicy, type ApiPolicy } from "../../app/settings/page";

describe("computeToggledPolicy", () => {
  test("preserves default surfaces when toggling new intent", () => {
    const prev: ApiPolicy = {
      policy_id: "p1",
      surfaces_by_intent: {
        dashboard: ["tasks_list"],
      },
    };

    const next = computeToggledPolicy(prev, "tasks", "create_task_form");

    // tasks intent should start from defaults (tasks_list + create_task_form)
    expect(next.surfaces_by_intent.tasks).toContain("tasks_list");
    // toggled surface should be removed (default contained it)
    expect(next.surfaces_by_intent.tasks).not.toContain("create_task_form");
    // notes intent should still include defaults
    expect(next.surfaces_by_intent.notes).toContain("notes_list");
  });
});
