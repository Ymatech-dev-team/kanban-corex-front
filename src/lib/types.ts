import type { TaskStatus, TaskPriority } from "@sistema-tasks/contracts";

export interface Project {
  id: string;
  name: string;
  description: string | null;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Member {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assigneeId: string | null;
  position: number;
  updatedAt?: string;
  subtasks?: Subtask[];
}
