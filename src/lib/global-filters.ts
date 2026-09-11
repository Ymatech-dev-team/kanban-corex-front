import type { TaskPriority } from "@sistema-tasks/contracts";

/** Estado dos filtros da visão global. `cliente`=projectId, `projeto`=engagementId, `resp`=assigneeId. [tarefas-visao-global] */
export type StatusFilter = "ATIVAS" | "TODO" | "DOING" | "DONE" | "TODAS";
export type PrazoPreset = "atrasadas" | "hoje" | "semana";

export interface GlobalFilters {
  cliente?: string;
  projeto?: string;
  resp?: string;
  status: StatusFilter; // default ATIVAS = A fazer + Fazendo (backend oculta DONE) [decisão JP]
  prio?: TaskPriority;
  prazo?: PrazoPreset;
}

export const DEFAULT_FILTERS: GlobalFilters = { status: "ATIVAS" };

/** Visualização da aba Tarefas (igual ao board). [tarefas-visao-global] */
export type TaskView = "kanban" | "lista" | "calendario";
export const TASK_VIEWS: TaskView[] = ["kanban", "lista", "calendario"];
export function parseView(v: string | null): TaskView | null {
  return v && (TASK_VIEWS as string[]).includes(v) ? (v as TaskView) : null;
}

const STATUS_VALUES: StatusFilter[] = ["ATIVAS", "TODO", "DOING", "DONE", "TODAS"];
const PRIO_VALUES: TaskPriority[] = ["HIGH", "MEDIUM", "LOW"];
const PRAZO_VALUES: PrazoPreset[] = ["atrasadas", "hoje", "semana"];

export function parseFilters(sp: URLSearchParams): GlobalFilters {
  const status = sp.get("status") as StatusFilter | null;
  const prio = sp.get("prio") as TaskPriority | null;
  const prazo = sp.get("prazo") as PrazoPreset | null;
  return {
    cliente: sp.get("cliente") || undefined,
    projeto: sp.get("projeto") || undefined,
    resp: sp.get("resp") || undefined,
    status: status && STATUS_VALUES.includes(status) ? status : "ATIVAS",
    prio: prio && PRIO_VALUES.includes(prio) ? prio : undefined,
    prazo: prazo && PRAZO_VALUES.includes(prazo) ? prazo : undefined,
  };
}

/** Só grava o que difere do default (URL limpa quando não há filtro). Não inclui `task` (a view cuida disso). */
export function filtersToSearchParams(f: GlobalFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.cliente) sp.set("cliente", f.cliente);
  if (f.projeto) sp.set("projeto", f.projeto);
  if (f.resp) sp.set("resp", f.resp);
  if (f.status !== "ATIVAS") sp.set("status", f.status);
  if (f.prio) sp.set("prio", f.prio);
  if (f.prazo) sp.set("prazo", f.prazo);
  return sp;
}

/** Facets do popover "Filtros" que estão ativos (viram chip): status≠default, prioridade, prazo. */
export function activeFacetCount(f: GlobalFilters): number {
  return (f.status !== "ATIVAS" ? 1 : 0) + (f.prio ? 1 : 0) + (f.prazo ? 1 : 0);
}

export function hasAnyFilter(f: GlobalFilters): boolean {
  return !!(f.cliente || f.projeto || f.resp || f.prio || f.prazo) || f.status !== "ATIVAS";
}

// Fronteiras de DIA no fuso local — robusto a qualquer hora do dueDate (não só o meio-dia do board). [RF-C8, review]
function startOfDay(base: Date, addDays = 0): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + addDays);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfDay(base: Date, addDays = 0): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + addDays);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Preset de prazo → intervalo { dueFrom?, dueTo? } em ISO (fronteiras de dia). */
export function prazoRange(preset: PrazoPreset, now: Date = new Date()): { dueFrom?: string; dueTo?: string } {
  if (preset === "atrasadas") return { dueTo: new Date(startOfDay(now).getTime() - 1).toISOString() }; // antes de hoje
  if (preset === "hoje") return { dueFrom: startOfDay(now).toISOString(), dueTo: endOfDay(now).toISOString() };
  return { dueFrom: startOfDay(now).toISOString(), dueTo: endOfDay(now, 6).toISOString() }; // semana: hoje..+6
}

/** Filtros → query string do GET /tasks. */
export function filtersToQuery(f: GlobalFilters, now?: Date): Record<string, string> {
  const q: Record<string, string> = {};
  if (f.cliente) q.projectId = f.cliente;
  if (f.projeto) q.engagementId = f.projeto;
  if (f.resp) q.assigneeId = f.resp;
  if (f.status === "TODO" || f.status === "DOING" || f.status === "DONE") q.status = f.status;
  else if (f.status === "TODAS") q.includeDone = "true";
  // ATIVAS → nada (backend já oculta DONE por padrão)
  if (f.prio) q.priority = f.prio;
  if (f.prazo) {
    const r = prazoRange(f.prazo, now);
    if (r.dueFrom) q.dueFrom = r.dueFrom;
    if (r.dueTo) q.dueTo = r.dueTo;
  }
  return q;
}
