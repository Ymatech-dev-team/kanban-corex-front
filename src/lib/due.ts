import type { Task } from "@/lib/types";
import type { TaskStatus } from "@sistema-tasks/contracts";

export type DueState = "none" | "normal" | "soon" | "overdue";

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Estado do prazo por dia (não por hora): venceu / vence hoje / vence amanhã / data.
 * Tarefa feita ou sem prazo → "none". `now` injetável para testes.
 */
export function dueState(
  dueDate: string | null,
  status: TaskStatus,
  now: number = Date.now(),
): { state: DueState; label: string } {
  if (!dueDate || status === "DONE") return { state: "none", label: "" };
  const due = new Date(dueDate);
  const diffDays = Math.round((startOfDay(due.getTime()) - startOfDay(now)) / 86_400_000);
  const dateLabel = fmt.format(due).replace(".", "");
  if (diffDays < 0) return { state: "overdue", label: `venceu ${dateLabel}` };
  if (diffDays === 0) return { state: "soon", label: "vence hoje" };
  if (diffDays === 1) return { state: "soon", label: "vence amanhã" };
  return { state: "normal", label: dateLabel };
}

/** Precisa de atenção: vencida ou vencendo (hoje/amanhã). */
export function needsAttention(task: Task, now?: number): boolean {
  const { state } = dueState(task.dueDate, task.status, now);
  return state === "soon" || state === "overdue";
}
