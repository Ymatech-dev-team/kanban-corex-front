import type { WorkflowChannel, WorkflowState } from "@sistema-tasks/contracts";
import { formatClock } from "@/lib/format-since";
import { workflowPresentation } from "@/lib/workflow-presentation";

/**
 * Estado vivo de uma tarefa com fluxo: derivação pura de WorkflowState + agora. [produto-telas RF3, design §3]
 * Primeira regra que casa vence; ver a tabela no design.
 */
export type LiveKind = "silent" | "blocked" | "changes" | "you" | "review" | "paused" | "running" | "planning" | "done";

export interface LiveStatus {
  kind: LiveKind;
  /** Rótulo curto: "Sem sinal", "Bloqueada", "Em revisão"… */
  label: string;
  /** Frase do estado (Folha › Agora › Estado). */
  sentence: string;
  /** Fazendo agora (próximo passo, ou objetivo); só em rodando, sem sinal e planejando. */
  doing: string | null;
  /** Por que parou: bloqueio, achado, pergunta ou aviso de sem sinal. */
  reason: string | null;
  /** summary.nextStep. */
  next: string | null;
  steps: { done: number; total: number; current: string | null } | null;
  lastSignalAt: string | null;
  who: string;
  channel: WorkflowChannel | null;
}

export const SILENT_AFTER_MS = 20 * 60_000;
export const URGENCY: LiveKind[] = ["silent", "blocked", "changes", "you", "review", "paused", "running", "planning", "done"];

export interface LiveStatusInput {
  state: WorkflowState;
  updatedAt: string;
  responsibleName?: string | null;
  openActionForMe?: { kind: string; question: string } | null;
}

const PAUSED_LABELS = { PAUSED: "Pausada", WAITING: "Aguardando", FINISHED: "Aguardando retomada" } as const;
const PLANNING_LABELS: Record<string, string> = { BACKLOG: "Backlog", PLANNING: "Planejando", READY: "Pronta", DOING: "Em execução manual" };

function latestSignal(state: WorkflowState, fallback: string): string {
  const candidates = [state.execution?.lastUpdatedAt, state.summary?.updatedAt]
    .filter((iso): iso is string => !!iso && !Number.isNaN(Date.parse(iso)));
  if (!candidates.length) return fallback;
  return candidates.reduce((best, iso) => (Date.parse(iso) > Date.parse(best) ? iso : best));
}

export function deriveLiveStatus(input: LiveStatusInput, now: Date): LiveStatus {
  const { state } = input;
  const summary = state.summary;
  const execution = state.execution;
  const presentation = workflowPresentation(state);
  const lastSignalAt = latestSignal(state, input.updatedAt);
  const signalMs = Date.parse(lastSignalAt);
  const sinceSignal = Number.isNaN(signalMs) ? 0 : now.getTime() - signalMs;
  const nextStep = summary?.nextStep || null;
  const blockers = summary?.blockers ?? [];

  const who = execution?.channel === "MCP" && execution.agent ? execution.agent : input.responsibleName || "Equipe";
  const steps = summary
    ? { done: summary.completed.length, total: summary.completed.length + summary.remaining.length, current: nextStep ?? summary.remaining[0] ?? null }
    : null;
  const make = (kind: LiveKind, label: string, sentence: string, extra: { doing?: string | null; reason?: string | null } = {}): LiveStatus => ({
    kind, label, sentence, doing: extra.doing ?? null, reason: extra.reason ?? null,
    next: nextStep, steps, lastSignalAt, who, channel: execution?.channel ?? null,
  });
  const doingNow = nextStep ?? (summary?.objective || null);

  if (state.stage === "DONE") return make("done", presentation.label, presentation.next);
  if (input.openActionForMe) return make("you", "Esperando você", "Esperando sua resposta", { reason: input.openActionForMe.question });
  // Em revisão o agente não deve relatar: RUNNING antigo ali não é falha. Com ajustes pedidos ele precisa retomar,
  // então o silêncio continua sendo informação verdadeira.
  const mayBeSilent = state.stage !== "IN_REVIEW";
  if (mayBeSilent && execution?.status === "RUNNING" && sinceSignal > SILENT_AFTER_MS) {
    return make("silent", "Sem sinal", "Sem sinal do agente", { doing: doingNow, reason: `Último relato às ${formatClock(lastSignalAt)}; nenhuma atualização desde então.` });
  }
  if (blockers.length > 0) return make("blocked", "Bloqueada", "Bloqueada, aguardando desbloqueio", { reason: blockers[0] });
  if (state.stage === "CHANGES_REQUESTED") return make("changes", "Ajustes pedidos", presentation.next, { reason: presentation.blocking[0]?.description ?? null });
  if (state.stage === "IN_REVIEW") {
    const agent = state.reviews.at(-1)?.reviewMode === "AGENT";
    return make("review", agent ? "Em revisão do agente" : "Em revisão", presentation.next);
  }
  if (execution && execution.status !== "RUNNING") return make("paused", PAUSED_LABELS[execution.status], presentation.next);
  if (execution?.status === "RUNNING") return make("running", "Rodando", "Agente trabalhando", { doing: doingNow });
  return make("planning", PLANNING_LABELS[state.stage] ?? "Acompanhamento", presentation.next, { doing: nextStep });
}
