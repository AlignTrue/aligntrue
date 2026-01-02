import type { BlockStateProps } from "@aligntrue/ui-renderer";

export function BlockState({ state, message, onRetry }: BlockStateProps) {
  const text =
    message ??
    (state === "loading"
      ? "Loading..."
      : state === "empty"
        ? "Nothing to show"
        : state === "error"
          ? "Something went wrong"
          : "");

  if (state === "ready") return null;

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
      <div>{text}</div>
      {state === "error" && onRetry ? (
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition hover:border-ring hover:text-foreground"
          onClick={onRetry}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
