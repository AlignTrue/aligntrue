import React from "react";
import { BlockEmpty } from "../../ui/BlockEmpty.js";
import { BlockList } from "../../ui/BlockList.js";
import { BlockStack } from "../../ui/BlockStack.js";
import { taskListManifest } from "./manifest.js";

export interface TaskListItem {
  id: string;
  title: string;
  due_at?: string;
}

export interface TaskListProps {
  title: string;
  tasks: TaskListItem[];
}

export function TaskList({ title, tasks }: TaskListProps) {
  return (
    <BlockStack>
      {title ? <h4 className="text-sm font-semibold">{title}</h4> : null}
      {tasks.length === 0 ? (
        <BlockEmpty>No tasks</BlockEmpty>
      ) : (
        <BlockList>
          {tasks.map((task) => (
            <li key={task.id} className="px-3 py-2">
              <div className="text-sm text-foreground">{task.title}</div>
              {task.due_at ? (
                <div className="text-xs text-muted-foreground">
                  Due {task.due_at}
                </div>
              ) : null}
            </li>
          ))}
        </BlockList>
      )}
    </BlockStack>
  );
}

export { taskListManifest };
