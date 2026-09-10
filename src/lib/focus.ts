import type { Task } from "@/lib/types";

const PRIORITY_RANK: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
export const PRIORITY_LABEL: Record<string, string> = { HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa" };

function priorityRank(p: string): number {
  return PRIORITY_RANK[p] ?? 0; // prioridade desconhecida → menor peso [REQ-10]
}
function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function dueKey(t: Task): number {
  return t.dueDate ? startOfDay(new Date(t.dueDate).getTime()) : Infinity; // sem prazo por último
}

/**
 * "Próximas a atacar" no Foco de hoje (fallback quando não há vencida/pra hoje).
 * 1º item = prazo mais próximo (desempate: prioridade desc → id); se nenhuma tem prazo, cai na ordem normal.
 * 2º em diante = ordem normal (prioridade desc → prazo asc → id). Determinístico entre refetches. [foco-proxima-tarefa]
 */
export function nextTasks(open: Task[], limit = 3): Task[] {
  if (open.length === 0) return [];
  const idAsc = (a: Task, b: Task) => (a.id < b.id ? -1 : 1);
  const normal = (a: Task, b: Task) =>
    priorityRank(b.priority) - priorityRank(a.priority) || dueKey(a) - dueKey(b) || idAsc(a, b);
  const sorted = [...open].sort(normal);
  const withDue = open.filter((t) => t.dueDate);
  const first = withDue.length
    ? [...withDue].sort(
        (a, b) => dueKey(a) - dueKey(b) || priorityRank(b.priority) - priorityRank(a.priority) || idAsc(a, b),
      )[0]
    : null;
  const list = first ? [first, ...sorted.filter((t) => t.id !== first.id)] : sorted;
  return list.slice(0, limit);
}
