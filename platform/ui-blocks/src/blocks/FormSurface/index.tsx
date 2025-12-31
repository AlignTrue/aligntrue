"use client";

import React, { useState, useEffect } from "react";
import type { InjectedBlockProps } from "@aligntrue/ui-renderer";
import { BlockForm } from "../../ui/BlockForm.js";
import { BlockStack } from "../../ui/BlockStack.js";
import { formSurfaceManifest } from "./manifest.js";

export interface FormSurfaceProps extends InjectedBlockProps {
  form_id: string;
  title?: string;
  submit_label?: string;
  fields: Array<{ name: string; label: string; value?: string }>;
  submit?: {
    allowed_command_types: string[];
    default_command_type?: string;
  };
}

export function FormSurface({
  form_id,
  title,
  submit_label = "Submit",
  fields,
  submit,
  block_instance_id,
  onAction,
  disabled,
}: FormSurfaceProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, f.value ?? ""])),
  );

  // Sync state when fields change to ensure new fields have their default values
  useEffect(() => {
    setValues((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const field of fields) {
        if (!(field.name in next)) {
          next[field.name] = field.value ?? "";
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [fields]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onAction || disabled) return;

    const allowed = submit?.allowed_command_types ?? [];
    const commandType =
      allowed.length === 1
        ? allowed[0]
        : (submit?.default_command_type ?? allowed[0]);

    if (!commandType) return;

    onAction({
      block_instance_id,
      action_type: "form.submitted",
      payload: { form_id, command_type: commandType, values },
    });

    setValues(Object.fromEntries(fields.map((f) => [f.name, ""])));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {title ? <h4 className="text-sm font-semibold">{title}</h4> : null}
      <BlockForm>
        <BlockStack>
          {fields.map((field) => (
            <label key={field.name} className="flex flex-col gap-2 text-sm">
              <span className="text-muted-foreground">{field.label}</span>
              <input
                value={values[field.name] ?? ""}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    [field.name]: event.target.value,
                  }))
                }
                name={field.name}
                className="rounded-md border border-border bg-background px-3 py-2 text-foreground shadow-sm focus:border-ring focus:outline-none"
              />
            </label>
          ))}
        </BlockStack>
      </BlockForm>
      <button
        type="submit"
        className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
      >
        {disabled ? "Creating..." : submit_label}
      </button>
    </form>
  );
}

export { formSurfaceManifest };
