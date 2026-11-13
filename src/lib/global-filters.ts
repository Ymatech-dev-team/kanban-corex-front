import type { TaskPriority } from "@sistema-tasks/contracts";
import type { LiveKind } from "@/lib/live-status";

/** Estado dos filtros da visão global. `cliente`=projectId, `projeto`=engagementId, `resp`=assigneeId. [tarefas-visao-global] */
export type StatusFilter = "ATIVAS" | "TODO" | "DOING" | "DONE" | "TODAS";
export type PrazoPreset = "atrasadas" | "hoje" | "semana";
/** Estado do fluxo (RF23): filtrado no cliente cruzando as tarefas com o feed da equipe; não vai para a API. */
export type FluxoFilter = "rodando" | "voce" | "parado" | "revisao";
export const FLUXO_VALUES: FluxoFilter[] = ["rodando", "voce", "parado", "revisao"];
export const FLUXO_LABEL: Record<FluxoFilter, string> = { rodando: "Rodando", voce: "Esperando você", parado: "Parado", revisao: "Em revisão" };
export const FLUXO_KINDS: Record<FluxoFilter, LiveKind[]> = {
  rodando: ["running"],
  voce: ["you"],
  parado: ["silent", "blocked", "paused", "changes"],
  revisao: ["review"],
};
/** RF23: com `fluxo` ativo ficam só as tarefas cujo estado vivo está no conjunto pedido; tarefa sem fluxo some. Sem `fluxo`, passa tudo. */
export function filterByFluxo<T extends { id: string }>(tasks: T[], live: Record<string, { kind: LiveKind } | undefined>, fluxo?: FluxoFilter): T[] {
  if (!fluxo) return tasks;
  const kinds = FLUXO_KINDS[fluxo];
  return tasks.filter((t) => {
    const status = live[t.id];
    return !!status && kinds.includes(status.kind);
  });
}

/** Limite do backend para `q` (RB4): acima disso a API responde 400. */
export const MAX_QUERY_LENGTH = 100;

export interface GlobalFilters {
  cliente?: string;
  projeto?: string;
  resp?: string;
  status: StatusFilter; // default ATIVAS = A fazer + Fazendo (backend oculta DONE) [decisão JP]
  prio?: TaskPriority;
  prazo?: PrazoPreset;
  q?: string; // busca por título (RB4)
  fluxo?: FluxoFilter; // estado do fluxo (RF23)
}

export const DEFAULT_FILTERS: GlobalFilters = { status: "ATIVAS" };

/**
 * Persistência do Cliente+Projeto da aba Tarefas (por navegador, igual à "view").
 * A sidebar lê isto pra recarregar o filtro ao voltar pra aba. [tarefas-persistir-filtro]
 */
const FILTERS_STORAGE_KEY = "sdt_tarefas_filtros";
export interface StoredClientProject {
  cliente?: string;
  projeto?: string;
}

/** Lê o Cliente+Projeto lembrado. Tolera storage ausente/corrompido e descarta projeto órfão (sem cliente). */
export function readStoredClientProject(): StoredClientProject {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return {};
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return {};
    const obj = v as Record<string, unknown>;
    const cliente = typeof obj.cliente === "string" && obj.cliente ? obj.cliente : undefined;
    // projeto só vale acompanhado de cliente (senão é lixo/edição manual)
    const projeto = cliente && typeof obj.projeto === "string" && obj.projeto ? obj.projeto : undefined;
    return { cliente, projeto };
  } catch {
    return {};
  }
}

/** Grava (ou limpa) o Cliente+Projeto lembrado. Sem cliente = limpa (o "Limpar filtros" cai aqui). */
export function writeStoredClientProject(cliente?: string, projeto?: string): void {
  try {
    if (!cliente) {
      localStorage.removeItem(FILTERS_STORAGE_KEY);
      return;
    }
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({ cliente, ...(projeto ? { projeto } : {}) }));
  } catch {
    /* localStorage indisponível — degrada pro comportamento atual (sem persistência) */
  }
}

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
  const fluxo = sp.get("fluxo") as FluxoFilter | null;
  const q = (sp.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH).trim();
  return {
    cliente: sp.get("cliente") || undefined,
    projeto: sp.get("projeto") || undefined,
    resp: sp.get("resp") || undefined,
    status: status && STATUS_VALUES.includes(status) ? status : "ATIVAS",
    prio: prio && PRIO_VALUES.includes(prio) ? prio : undefined,
    prazo: prazo && PRAZO_VALUES.includes(prazo) ? prazo : undefined,
    ...(q ? { q } : {}),
    ...(fluxo && FLUXO_VALUES.includes(fluxo) ? { fluxo } : {}),
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
  if (f.fluxo) sp.set("fluxo", f.fluxo);
  if (f.q?.trim()) sp.set("q", f.q.trim());
  return sp;
}

/** Facets do popover "Filtros" que estão ativos (viram ficha): status≠default, estado do fluxo, prioridade, prazo. */
export function activeFacetCount(f: GlobalFilters): number {
  return (f.status !== "ATIVAS" ? 1 : 0) + (f.fluxo ? 1 : 0) + (f.prio ? 1 : 0) + (f.prazo ? 1 : 0);
}

export function hasAnyFilter(f: GlobalFilters): boolean {
  return !!(f.cliente || f.projeto || f.resp || f.prio || f.prazo || f.fluxo || f.q?.trim()) || f.status !== "ATIVAS";
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
  if (f.q?.trim()) q.q = f.q.trim(); // `fluxo` fica de fora de propósito: filtrado no cliente (RF23)
  if (f.prazo) {
    const r = prazoRange(f.prazo, now);
    if (r.dueFrom) q.dueFrom = r.dueFrom;
    if (r.dueTo) q.dueTo = r.dueTo;
  }
  return q;
}

// ---------------------------------------------------------------- visões (RF19/RF24)

export interface ViewDef {
  id: string;
  label: string;
  filters: GlobalFilters;
}

/** Visões embutidas = conjuntos de params. `Minhas` só existe quando se sabe quem é o usuário. */
export function builtinViews(meId?: string): ViewDef[] {
  const views: ViewDef[] = [{ id: "ativas", label: "Ativas", filters: { ...DEFAULT_FILTERS } }];
  if (meId) views.push({ id: "minhas", label: "Minhas", filters: { ...DEFAULT_FILTERS, resp: meId } });
  views.push(
    { id: "rodando", label: "Rodando", filters: { ...DEFAULT_FILTERS, fluxo: "rodando" } },
    { id: "voce", label: "Esperando você", filters: { ...DEFAULT_FILTERS, fluxo: "voce" } },
    { id: "atrasadas", label: "Atrasadas", filters: { ...DEFAULT_FILTERS, prazo: "atrasadas" } },
  );
  return views;
}

/** A visão ativa é aquela cujos params batem exatamente com os filtros atuais. */
export function matchView(views: ViewDef[], f: GlobalFilters): ViewDef | undefined {
  const key = filtersToSearchParams(f).toString();
  return views.find((v) => filtersToSearchParams(v.filters).toString() === key);
}

/** Visão salva do usuário, guardada no navegador (D8: sem backend; não sincroniza entre aparelhos). */
export interface SavedView {
  id: string;
  name: string;
  params: string; // query string de filtersToSearchParams
}
/** Chave por usuário: o navegador pode ser compartilhado. A chave antiga, sem usuário, é ignorada (não dá para saber de quem era). */
const viewsStorageKey = (userId: string) => `sdt_tarefas_visoes:${userId}`;
const MAX_SAVED_VIEWS = 20;
export const MAX_VIEW_NAME = 40;

/** Lê as visões salvas do usuário. Sem usuário ou com qualquer falha (storage bloqueado, JSON ruim, formato inesperado) → [] (só as embutidas). */
export function readSavedViews(userId: string | undefined): SavedView[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(viewsStorageKey(userId));
    if (!raw) return [];
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const out: SavedView[] = [];
    for (const item of v) {
      if (typeof item !== "object" || item === null) continue;
      const o = item as Record<string, unknown>;
      if (typeof o.id !== "string" || !o.id || typeof o.name !== "string" || !o.name.trim() || typeof o.params !== "string") continue;
      out.push({ id: o.id, name: o.name.trim().slice(0, MAX_VIEW_NAME), params: o.params });
      if (out.length >= MAX_SAVED_VIEWS) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Grava as visões salvas; devolve false quando o storage não está disponível (a tela segue só com as embutidas). */
export function writeSavedViews(userId: string | undefined, views: SavedView[]): boolean {
  if (!userId) return false;
  try {
    localStorage.setItem(viewsStorageKey(userId), JSON.stringify(views.slice(0, MAX_SAVED_VIEWS)));
    return true;
  } catch {
    return false;
  }
}

export function savedViewToDef(v: SavedView): ViewDef {
  return { id: v.id, label: v.name, filters: parseFilters(new URLSearchParams(v.params)) };
}
