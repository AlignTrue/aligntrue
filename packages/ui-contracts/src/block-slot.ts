export type BlockSlot =
  | "main"
  | "left"
  | "right"
  | "header"
  | "footer"
  | "sidebar";

export const VALID_SLOTS: readonly BlockSlot[] = [
  "main",
  "left",
  "right",
  "header",
  "footer",
  "sidebar",
];

export function isValidSlot(slot: string): slot is BlockSlot {
  return VALID_SLOTS.includes(slot as BlockSlot);
}
