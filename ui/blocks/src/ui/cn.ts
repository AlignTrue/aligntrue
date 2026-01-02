// Lightweight className joiner for UI blocks.
// Intentionally does not use tailwind-merge; use @aligntrue/ui-base/cn for app-level merging.
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
