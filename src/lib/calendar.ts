import type { Task } from "@/lib/types";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Chave de dia no fuso local (yyyy-mm-dd), estável pra agrupar por prazo. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Matriz 6×7 de dias cobrindo o mês (com dias vizinhos preenchendo as bordas). Semana começa no domingo. */
export function buildMonthMatrix(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay()); // volta até o domingo
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const days: Date[] = [];
    for (let d = 0; d < 7; d++) {
      days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d));
    }
    weeks.push(days);
  }
  return weeks;
}

/** Agrupa tarefas com prazo por dia (yyyy-mm-dd local). Tarefas sem prazo ficam de fora. */
export function groupTasksByDay(tasks: Task[]): Record<string, Task[]> {
  const map: Record<string, Task[]> = {};
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const key = dayKey(new Date(t.dueDate));
    (map[key] ??= []).push(t);
  }
  return map;
}
