"use client";

import { useTransition } from "react";

type Props = {
  taskId: string;
  bucket: string;
  status: string;
  triageAction: (formData: FormData) => Promise<void>;
  completeAction: (formData: FormData) => Promise<void>;
};

export function TaskActions({
  taskId,
  bucket,
  status,
  triageAction,
  completeAction,
}: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <form action={triageAction} className="flex items-center gap-2">
        <input type="hidden" name="task_id" value={taskId} />
        <select
          name="bucket"
          defaultValue={bucket}
          className="h-9 rounded-md border px-2 text-sm"
          disabled={pending}
          onChange={(e) => {
            startTransition(() => {
              e.currentTarget.form?.requestSubmit();
            });
          }}
        >
          <option value="today">Today</option>
          <option value="week">Week</option>
          <option value="later">Later</option>
          <option value="waiting">Waiting</option>
        </select>
      </form>
      <form action={completeAction}>
        <input type="hidden" name="task_id" value={taskId} />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="completed"
            defaultChecked={status === "completed"}
            disabled={pending}
            onChange={(e) => {
              startTransition(() => {
                e.currentTarget.form?.requestSubmit();
              });
            }}
            className="h-4 w-4 rounded border-border"
          />
          <span>Complete</span>
        </label>
      </form>
    </div>
  );
}
