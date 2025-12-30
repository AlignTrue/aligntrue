import React from "react";
import { entityTableManifest } from "./manifest.js";

export interface EntityTableItem {
  id: string;
  label: string;
  email?: string;
}

export interface EntityTableProps {
  title: string;
  items: EntityTableItem[];
}

export function EntityTable({ title, items }: EntityTableProps) {
  return (
    <div data-block="entity-table">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.label}</li>
        ))}
      </ul>
    </div>
  );
}

export { entityTableManifest };
