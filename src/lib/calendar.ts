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

/** Prefixo yyyy-mm de uma data local (mesmo esquema de dayKey), pra filtrar chaves por mês sem reparsear. */
function monthPrefix(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/**
 * Dias do mês do `cursor` que têm tarefa, em ordem cronológica crescente — pra agenda mobile.
 * Filtra as chaves de `byDay` pelo prefixo yyyy-mm (as chaves já são locais/corretas); NÃO reparseia
 * com `new Date(key)`, que interpretaria a string como UTC e deslocaria o dia em fusos negativos.
 * Dentro do dia, ordena por status (abertas antes de concluídas) e depois posição, estável.
 */
export function agendaDaysForMonth(
  byDay: Record<string, Task[]>,
  cursor: Date,
): { key: string; date: Date; tasks: Task[] }[] {
  const prefix = monthPrefix(cursor); // "yyyy-mm"
  return Object.keys(byDay)
    .filter((k) => k.startsWith(prefix + "-"))
    .sort()
    .map((key) => {
      const [y, m, d] = key.split("-").map(Number);
      const tasks = [...byDay[key]].sort(
        (a, b) =>
          (a.status === "DONE" ? 1 : 0) - (b.status === "DONE" ? 1 : 0) || a.position - b.position,
      );
      return { key, date: new Date(y, m - 1, d), tasks };
    });
}
