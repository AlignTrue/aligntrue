import React from "react";
import { formSurfaceManifest } from "./manifest.js";

export interface FormSurfaceProps {
  fields: Array<{ name: string; label: string; value?: string }>;
}

export function FormSurface({ fields }: FormSurfaceProps) {
  return (
    <form data-block="form-surface">
      {fields.map((field) => (
        <label key={field.name}>
          {field.label}
          <input defaultValue={field.value} name={field.name} />
        </label>
      ))}
    </form>
  );
}

export { formSurfaceManifest };
