import React from "react";
import { BlockForm } from "../../ui/BlockForm.js";
import { BlockStack } from "../../ui/BlockStack.js";
import { formSurfaceManifest } from "./manifest.js";

export interface FormSurfaceProps {
  fields: Array<{ name: string; label: string; value?: string }>;
}

export function FormSurface({ fields }: FormSurfaceProps) {
  return (
    <BlockForm>
      <BlockStack>
        {fields.map((field) => (
          <label key={field.name} className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">{field.label}</span>
            <input
              defaultValue={field.value}
              name={field.name}
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground shadow-sm focus:border-ring focus:outline-none"
            />
          </label>
        ))}
      </BlockStack>
    </BlockForm>
  );
}

export { formSurfaceManifest };
