import type { Task } from "@/lib/types";
import { type BoardFilters, prazoRange } from "@/lib/board-filters";

/** Filtro de responsável do quadro. Cliente-side sobre as tarefas já carregadas. */
export type AssigneeFilter = { type: "all" } | { type: "none" } | { type: "user"; id: string };

export const ALL_ASSIGNEES: AssigneeFilter = { type: "all" };

export function filterByAssignee(tasks: Task[], f: AssigneeFilter): Task[] {
  if (f.type === "all") return tasks;
  // "sem responsável" = sem principal E sem extras [detalhe-tarefa RF-R9]
  if (f.type === "none") return tasks.filter((t) => t.assigneeId == null && (t.extraAssigneeIds?.length ?? 0) === 0);
  return tasks.filter((t) => t.assigneeId === f.id || (t.extraAssigneeIds?.includes(f.id) ?? false));
}

export function isFiltering(f: AssigneeFilter): boolean {
  return f.type !== "all";
}

/** `BoardFilters.resp` → AssigneeFilter (undefined = todos, "none" = sem responsável, senão userId). */
export function respToAssignee(resp?: string): AssigneeFilter {
  if (resp === undefined) return { type: "all" };
  if (resp === "none") return { type: "none" };
  return { type: "user", id: resp };
}

/**
 * Filtro rico do board, client-side e em E lógico. No Kanban o chamador passa `ignoreStatus`
 * (as colunas já são o status). Prazo é recalculado agora (`prazoRange`), nunca gravado absoluto.
 */
export function filterTasks(
  tasks: Task[],
  f: BoardFilters,
  opts?: { ignoreStatus?: boolean; now?: Date },
): Task[] {
  let out = filterByAssignee(tasks, respToAssignee(f.resp));
  if (!opts?.ignoreStatus && f.status) out = out.filter((t) => t.status === f.status);
  if (f.prio) out = out.filter((t) => t.priority === f.prio);
  if (f.prazo) {
    const { dueFrom, dueTo } = prazoRange(f.prazo, opts?.now);
    const from = dueFrom ? new Date(dueFrom).getTime() : null;
    const to = dueTo ? new Date(dueTo).getTime() : null;
    out = out.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate).getTime();
      if (from !== null && d < from) return false;
      if (to !== null && d > to) return false;
      return true;
    });
  }
  return out;
}
