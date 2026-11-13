import type { WorkflowState } from "@sistema-tasks/contracts";
import type { WorkflowAction } from "@/lib/hooks/use-workflow";
import { URGENCY, deriveLiveStatus, type LiveKind, type LiveStatus } from "@/lib/live-status";
import { httpStatus } from "@/lib/http-error";
import type { Task } from "@/lib/types";

/** Item do feed (RB1 `/team` ou fallback `/mine`): o `/mine` não traz nomes de pessoas nem o id do cliente. */
export interface FeedItem {
  taskId: string;
  title: string;
  clientId?: string;
  clientName: string;
  projectName: string;
  responsibleName?: string | null;
  assigneeName?: string | null;
  updatedAt: string;
  state: WorkflowState;
}

/** O servidor devolve `createdAt` nos pedidos; o tipo do hook (F0) ainda não o declara. */
export type AgoraAction = WorkflowAction & { createdAt?: string };

export interface AgoraRow {
  item: FeedItem;
  live: LiveStatus;
  /** Pedido aberto para o usuário nesta tarefa, quando houver. */
  action: AgoraAction | null;
}

export type ViewFilter = "rodando" | "voce" | "sinal";
export type GroupBy = "estado" | "pessoa" | "cliente";
export const VIEW_FILTERS: ViewFilter[] = ["rodando", "voce", "sinal"];
export const GROUPS: GroupBy[] = ["estado", "pessoa", "cliente"];

export const parseView = (value: string | null | undefined): ViewFilter | null => (VIEW_FILTERS as string[]).includes(value ?? "") ? (value as ViewFilter) : null;
export const parseGroup = (value: string | null | undefined): GroupBy => (GROUPS as string[]).includes(value ?? "") ? (value as GroupBy) : "estado";

const BRT_OFFSET_MS = 3 * 3_600_000;
/** 00:00 de hoje em BRT (UTC-3, sem horário de verão), em ms UTC. */
export function startOfDayBrt(now: Date): number {
  return Math.floor((now.getTime() - BRT_OFFSET_MS) / 86_400_000) * 86_400_000 + BRT_OFFSET_MS;
}

const rank = (kind: LiveKind) => URGENCY.indexOf(kind);
const time = (iso: string | null) => (iso ? Date.parse(iso) || 0 : 0);

/** Junta feed e pedidos abertos; só execuções não concluídas, ordenadas por urgência (RF11) e, dentro do estado, por último sinal. */
export function buildRows(items: FeedItem[], actions: AgoraAction[], now: Date): AgoraRow[] {
  const byTask = new Map<string, AgoraAction>();
  // O pedido mais antigo de cada tarefa é o que está esperando há mais tempo (o último a gravar vence).
  for (const action of [...actions].sort((a, b) => time(b.createdAt ?? null) - time(a.createdAt ?? null))) byTask.set(action.taskId, action);
  const rows: AgoraRow[] = [];
  for (const item of items) {
    if (item.state.stage === "DONE") continue;
    const action = byTask.get(item.taskId) ?? null;
    const live = deriveLiveStatus({ state: item.state, updatedAt: item.updatedAt, responsibleName: item.responsibleName, openActionForMe: action ? { kind: action.kind, question: action.question } : null }, now);
    rows.push({ item, live, action });
  }
  return rows.sort((a, b) => rank(a.live.kind) - rank(b.live.kind)
    // Sem sinal: o mais antigo primeiro (pior caso); nos demais, o mais recente.
    || (a.live.kind === "silent" ? time(a.live.lastSignalAt) - time(b.live.lastSignalAt) : time(b.live.lastSignalAt) - time(a.live.lastSignalAt))
    || a.item.taskId.localeCompare(b.item.taskId));
}

export interface DoneRow { item: FeedItem; live: LiveStatus; verb: string }

const DONE_VERB: Record<string, string> = {
  "Concluída com exceção": "aprovou mesmo assim",
  "Concluída com ressalvas": "concluiu com ressalvas",
  "Concluída pelo quadro": "concluiu pelo quadro",
};
/** Concluídas desde 00:00 BRT, mais recentes primeiro. */
export function buildDoneToday(items: FeedItem[], now: Date): DoneRow[] {
  const since = startOfDayBrt(now);
  return items
    .filter(item => item.state.stage === "DONE" && time(item.updatedAt) >= since)
    .sort((a, b) => time(b.updatedAt) - time(a.updatedAt))
    .map(item => {
      const live = deriveLiveStatus({ state: item.state, updatedAt: item.updatedAt, responsibleName: item.responsibleName }, now);
      return { item, live, verb: DONE_VERB[live.label] ?? "concluiu" };
    });
}

export interface Counts { running: number; waiting: number; silent: number; done: number }
export function countRows(rows: AgoraRow[], actions: AgoraAction[], done: DoneRow[]): Counts {
  return {
    running: rows.filter(row => row.live.kind === "running").length,
    waiting: new Set(actions.map(action => action.taskId)).size,
    silent: rows.filter(row => row.live.kind === "silent").length,
    done: done.length,
  };
}

export function filterRows(rows: AgoraRow[], view: ViewFilter | null): AgoraRow[] {
  if (!view) return rows;
  const kind: LiveKind = view === "rodando" ? "running" : view === "voce" ? "you" : "silent";
  return rows.filter(row => row.live.kind === kind);
}

export const KIND_GROUP_LABEL: Record<LiveKind, string> = {
  silent: "Sem sinal", blocked: "Bloqueadas", changes: "Ajustes pedidos", you: "Esperando você", review: "Em revisão",
  paused: "Pausadas e aguardando", running: "Rodando", planning: "Planejando e prontas", done: "Concluídas",
};

export interface RowGroup { key: string; label: string; rows: AgoraRow[] }

/** Agrupa preservando a ordem de urgência dentro de cada grupo. */
export function groupRows(rows: AgoraRow[], by: GroupBy): RowGroup[] {
  const groups = new Map<string, RowGroup>();
  for (const row of rows) {
    const label = by === "estado" ? KIND_GROUP_LABEL[row.live.kind] : by === "pessoa" ? row.live.who : row.item.clientName || "Sem cliente";
    const key = by === "estado" ? row.live.kind : label;
    const group = groups.get(key) ?? { key, label, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  const list = [...groups.values()];
  if (by === "estado") return list.sort((a, b) => rank(a.key as LiveKind) - rank(b.key as LiveKind));
  return list.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

/** Quanto do que foi feito cabe na expansão (RF13): os 3 últimos. */
export const lastDone = (state: WorkflowState): string[] => state.summary?.completed.slice(-3) ?? [];

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;
const MS_DAY = 86_400_000;
const startOfBrtDay = (ms: number) => startOfDayBrt(new Date(ms));

/** Fim do domingo da semana corrente (segunda a domingo), em BRT fixo como o resto da tela. */
export function endOfWeekSunday(now: Date): Date {
  const wall = new Date(now.getTime() - BRT_OFFSET_MS); // relógio de parede de BRT lido com getters UTC
  const sinceMonday = (wall.getUTCDay() + 6) % 7;
  const sundayWallMidnight = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() - sinceMonday + 6);
  return new Date(sundayWallMidnight + MS_DAY - 1 + BRT_OFFSET_MS);
}

export interface DeadlineRow { task: Task; label: string; overdue: boolean }
export const DEADLINE_LIMIT = 8;

/** Não concluídas, vencidas ou com prazo até domingo; mais antigas primeiro; no máximo 8 (RF14). Datas em BRT. */
export function buildDeadlines(tasks: Task[], now: Date): DeadlineRow[] {
  const limit = endOfWeekSunday(now).getTime();
  const today = startOfBrtDay(now.getTime());
  return tasks
    .filter(task => task.status !== "DONE" && !!task.dueDate && !Number.isNaN(Date.parse(task.dueDate)) && Date.parse(task.dueDate) <= limit)
    .sort((a, b) => Date.parse(a.dueDate!) - Date.parse(b.dueDate!) || a.id.localeCompare(b.id))
    .slice(0, DEADLINE_LIMIT)
    .map(task => {
      const dueMs = Date.parse(task.dueDate!);
      const wall = new Date(dueMs - BRT_OFFSET_MS);
      return { task, label: `${String(wall.getUTCDate()).padStart(2, "0")} ${MONTHS[wall.getUTCMonth()]}`, overdue: startOfBrtDay(dueMs) < today };
    });
}

/** Rótulo único do canal (WorkflowChannel). Folha e demais telas devem importar este mapa. */
export const CHANNEL_LABEL = { MCP: "MCP", WEB: "Painel", LOCAL_SYNC: "Sincronização local" } as const;

/** Texto "o que está acontecendo" da coluna Agora (RF11), a partir do estado vivo. */
export function nowText(live: LiveStatus): string {
  if (live.kind === "silent") return live.doing ? `Parou em: ${live.doing}` : live.reason ?? live.sentence;
  if (live.kind === "blocked") return live.reason ? `Bloqueio: ${live.reason}` : live.sentence;
  if (live.kind === "changes") return live.reason ? `Achado: ${live.reason}` : live.sentence;
  return live.doing ?? live.reason ?? live.sentence;
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
/** "qui 12 nov · 14:32" em BRT. */
export function formatSituationDate(now: Date): string {
  const brt = new Date(now.getTime() - BRT_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${WEEKDAYS[brt.getUTCDay()]} ${brt.getUTCDate()} ${MONTHS[brt.getUTCMonth()]} · ${pad(brt.getUTCHours())}:${pad(brt.getUTCMinutes())}`;
}

/**
 * Erro de autorização/acesso (401, 403, 404): dado em cache não pode continuar na tela, nem como "nenhum pedido".
 * Erro de rede ou 5xx mantém o último estado carregado, com aviso.
 */
export function isAccessDenied(error: unknown): boolean {
  const status = httpStatus(error);
  return status === 401 || status === 403 || status === 404;
}
