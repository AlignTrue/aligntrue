"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type PolicyContent = {
  surfaces_by_intent: Record<string, string[]>;
};

const DEFAULT_CONTENT: PolicyContent["surfaces_by_intent"] = {
  dashboard: ["tasks_list", "notes_list"],
  tasks: ["tasks_list", "create_task_form"],
  notes: ["notes_list", "create_note_form"],
};

export function computeToggledPolicy(
  prev: ApiPolicy | null,
  intent: string,
  surface: string,
): ApiPolicy {
  // Merge defaults with current policy so we never drop default surfaces
  const merged = prev?.surfaces_by_intent
    ? { ...DEFAULT_CONTENT, ...prev.surfaces_by_intent }
    : DEFAULT_CONTENT;
  // eslint-disable-next-line security/detect-object-injection
  const existing = new Set(merged[intent] ?? []);
  if (existing.has(surface)) {
    existing.delete(surface);
  } else {
    existing.add(surface);
  }
  return {
    policy_id: prev?.policy_id ?? null,
    surfaces_by_intent: {
      ...merged,
      [intent]: Array.from(existing),
    },
  };
}

export type ApiPolicy = {
  policy_id: string | null;
  surfaces_by_intent: Record<string, string[]>;
};

async function fetchPolicy(): Promise<ApiPolicy> {
  const res = await fetch("/api/policy", { cache: "no-store" });
  if (!res.ok) {
    return { policy_id: null, surfaces_by_intent: DEFAULT_CONTENT };
  }
  return (await res.json()) as ApiPolicy;
}

export default function SettingsPage() {
  const [policy, setPolicy] = useState<ApiPolicy | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetchPolicy().then((data) => setPolicy(data));
  }, []);

  const surfaces = useMemo(() => {
    if (!policy) return DEFAULT_CONTENT;
    return {
      ...DEFAULT_CONTENT,
      ...policy.surfaces_by_intent,
    };
  }, [policy]);

  function toggle(intent: string, surface: string) {
    setPolicy((prev) => computeToggledPolicy(prev, intent, surface));
  }

  async function handleSave() {
    if (!policy) return;
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: {
            surfaces_by_intent: policy.surfaces_by_intent,
          },
        }),
      });
      if (res.ok) {
        await res.json();
        setMessage("Preferences saved");
      } else {
        setMessage("Failed to save policy");
      }
    });
  }

  const intents: Array<{ key: string; label: string }> = [
    { key: "dashboard", label: "Dashboard" },
    { key: "tasks", label: "Tasks" },
    { key: "notes", label: "Notes" },
  ];

  const surfacesList = [
    { key: "tasks_list", label: "Tasks list" },
    { key: "notes_list", label: "Notes list" },
    { key: "create_task_form", label: "Create task form" },
    { key: "create_note_form", label: "Create note form" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>UI Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {intents.map((intent) => (
            <div key={intent.key} className="space-y-2">
              <div className="text-sm font-medium">{intent.label}</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {surfacesList.map((surface) => (
                  <label
                    key={`${intent.key}-${surface.key}`}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={(surfaces[intent.key] ?? []).includes(
                        surface.key,
                      )}
                      onCheckedChange={() => toggle(intent.key, surface.key)}
                      disabled={pending}
                    />
                    <span>{surface.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button onClick={handleSave} disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
            {message ? (
              <span className="text-sm text-muted-foreground">{message}</span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
