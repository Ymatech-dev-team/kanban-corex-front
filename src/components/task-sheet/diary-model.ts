import type { LiveKind } from "@/lib/live-status";
import type { WorkflowHistoryEvent } from "@/lib/hooks/use-workflow";
import type { TaskActivity } from "@/lib/types";
import { formatClock } from "@/lib/format-since";

/**
 * Modelo do Diário: intercala por horário os eventos do fluxo (`useWorkflowHistory`) com a atividade e os
 * comentários (`useTaskActivity`). Horas e dias em BRT por offset fixo (igual a `format-since`). [RF33]
 */
const BRT_OFFSET_MS = -3 * 3_600_000;
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;
const pad = (n: number) => String(n).padStart(2, "0");
const toBrt = (ms: number) => new Date(ms + BRT_OFFSET_MS);
const dayNumber = (brt: Date) => Math.floor(brt.getTime() / 86_400_000);

export type DiaryItem =
  | { key: string; at: string; source: "flow"; kind: LiveKind; event: WorkflowHistoryEvent }
  | { key: string; at: string; source: "activity"; kind: LiveKind; activity: TaskActivity };

const FLOW_KIND: Record<string, LiveKind> = {
  start_execution: "running", report_progress: "running", record_evidence: "running",
  submit_review: "review",
  record_finding: "changes", request_changes: "changes",
  approve_review: "done", approve_anyway: "done", approve_with_reservations: "done", validate_finding: "done",
  request_action: "you",
};

export function flowKind(type: string): LiveKind {
  return FLOW_KIND[type] ?? "planning";
}

const time = (iso: string) => { const ms = Date.parse(iso); return Number.isNaN(ms) ? 0 : ms; };
/** Janela em que um movimento pelo quadro aparece nas duas fontes (fluxo e atividade) como o mesmo fato. */
export const BOARD_MOVE_DEDUP_MS = 5_000;

/** `STATUS_CHANGED` da atividade que repete um `board_move` do fluxo (mesmo destino, até 5 s de diferença). */
function duplicatesBoardMove(entry: TaskActivity, history: WorkflowHistoryEvent[]): boolean {
  if (entry.type !== "STATUS_CHANGED") return false;
  const to = entry.payload?.to;
  if (typeof to !== "string") return false;
  return history.some((event) => event.type === "board_move" && event.payload?.to === to && Math.abs(time(event.createdAt) - time(entry.createdAt)) <= BOARD_MOVE_DEDUP_MS);
}

export function mergeDiary(history: WorkflowHistoryEvent[], activity: TaskActivity[]): DiaryItem[] {
  const items: DiaryItem[] = [
    ...history.map((event): DiaryItem => ({ key: `f:${event.id}`, at: event.createdAt, source: "flow", kind: flowKind(event.type), event })),
    ...activity.filter((entry) => !duplicatesBoardMove(entry, history)).map((entry): DiaryItem => ({ key: `a:${entry.id}`, at: entry.createdAt, source: "activity", kind: "planning", activity: entry })),
  ];
  // Mais recente primeiro; empate mantém a ordem de chegada (sort estável).
  return items.sort((a, b) => time(b.at) - time(a.at));
}

/** "Hoje" · "Ontem" · "DD mmm" (com o ano quando não é o corrente). Dia decidido em BRT. */
export function dayLabel(iso: string, now: Date): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "Sem data";
  const then = toBrt(ms);
  const gap = dayNumber(toBrt(now.getTime())) - dayNumber(then);
  if (gap <= 0) return "Hoje";
  if (gap === 1) return "Ontem";
  const base = `${pad(then.getUTCDate())} ${MONTHS[then.getUTCMonth()]}`;
  return then.getUTCFullYear() === toBrt(now.getTime()).getUTCFullYear() ? base : `${base} ${then.getUTCFullYear()}`;
}

/** Chave do dia em BRT, para agrupar. */
export function dayKey(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "?" : String(dayNumber(toBrt(ms)));
}

/** "DD/MM HH:MM" em BRT, para carimbos. */
export function formatStamp(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  const d = toBrt(ms);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)} ${formatClock(iso)}`;
}
