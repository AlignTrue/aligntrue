import React from "react";
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
    <div data-block="task-list">
      <h4>{title}</h4>
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            {task.title}
            {task.due_at ? ` — due ${task.due_at}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

export { taskListManifest };
