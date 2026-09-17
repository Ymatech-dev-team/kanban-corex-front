import type { TaskPriority } from "@sistema-tasks/contracts";
import { type PrazoPreset, prazoRange } from "./global-filters";

/** Filtros do board por cliente. Tipo próprio (não reusa GlobalFilters — cliente/projeto são a rota). */
export type BoardStatus = "TODO" | "DOING" | "DONE";

export interface BoardFilters {
  resp?: string; // "none" (sem responsável) | userId; ausente = todos
  status?: BoardStatus; // oculto no Kanban (colunas já são o status)
  prio?: TaskPriority;
  prazo?: PrazoPreset; // símbolo — recalculado no apply
}

export const EMPTY_BOARD_FILTERS: BoardFilters = {};

export function hasAnyBoardFilter(f: BoardFilters): boolean {
  return f.resp !== undefined || f.status !== undefined || f.prio !== undefined || f.prazo !== undefined;
}

/** Ignora status — usado no Kanban pra decidir "tem filtro?" (status não conta lá). */
export function hasBoardFilterExceptStatus(f: BoardFilters): boolean {
  return f.resp !== undefined || f.prio !== undefined || f.prazo !== undefined;
}

export function boardFiltersEqual(a: BoardFilters, b: BoardFilters): boolean {
  return a.resp === b.resp && a.status === b.status && a.prio === b.prio && a.prazo === b.prazo;
}

const PRIOS: TaskPriority[] = ["HIGH", "MEDIUM", "LOW"];
const STATUSES: BoardStatus[] = ["TODO", "DOING", "DONE"];
const PRAZOS: PrazoPreset[] = ["atrasadas", "hoje", "semana"];

/** Tolerante: descarta valores fora do enum (preset envelhecido/editado na mão). [RF-18] */
export function parseBoardFilters(v: unknown): BoardFilters {
  if (typeof v !== "object" || v === null) return {};
  const o = v as Record<string, unknown>;
  const f: BoardFilters = {};
  if (typeof o.resp === "string" && o.resp) f.resp = o.resp;
  if (typeof o.status === "string" && (STATUSES as string[]).includes(o.status)) f.status = o.status as BoardStatus;
  if (typeof o.prio === "string" && (PRIOS as string[]).includes(o.prio)) f.prio = o.prio as TaskPriority;
  if (typeof o.prazo === "string" && (PRAZOS as string[]).includes(o.prazo)) f.prazo = o.prazo as PrazoPreset;
  return f;
}

export const PRIO_LABEL: Record<TaskPriority, string> = { HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa" };
export const STATUS_LABEL: Record<BoardStatus, string> = { TODO: "A fazer", DOING: "Fazendo", DONE: "Feito" };
export const PRAZO_LABEL: Record<PrazoPreset, string> = {
  atrasadas: "Atrasadas",
  hoje: "Hoje",
  semana: "Esta semana",
};
export const PRIO_OPTIONS = PRIOS;
export const STATUS_OPTIONS = STATUSES;
export const PRAZO_OPTIONS = PRAZOS;

/** Nome normalizado pra detectar duplicado (bate com a service do backend). */
export function normPresetName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// --- Preset aplicado lembrado por cliente (só o id) no localStorage. [F5] ---
const appliedKey = (projectId: string) => `sdt_board_preset:${projectId}`;
export function readAppliedPresetId(projectId: string): string | null {
  try {
    return localStorage.getItem(appliedKey(projectId)) || null;
  } catch {
    return null;
  }
}
export function writeAppliedPresetId(projectId: string, id: string | null): void {
  try {
    if (id) localStorage.setItem(appliedKey(projectId), id);
    else localStorage.removeItem(appliedKey(projectId));
  } catch {
    /* localStorage indisponível — degrada sem persistir */
  }
}

// re-export pro board usar sem importar de dois lugares
export { prazoRange };
export type { PrazoPreset };
