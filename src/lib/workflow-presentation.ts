import type { WorkflowState } from "@sistema-tasks/contracts";

const required = ["typecheck", "lint", "test", "build"];
export function workflowPresentation(state: WorkflowState) {
  const latestReview = state.reviews.at(-1);
  const review = latestReview?.deliveryRevision === state.deliveryRevision ? latestReview : undefined;
  const boardCompletion = state.boardCompletion?.deliveryRevision === state.deliveryRevision;
  const agent = state.execution?.channel === "MCP" ? state.execution.agent : null;
  const failed = review?.checks.filter(check => check.required && check.status === "failed").map(check => check.name) ?? [];
  const missing = required.filter(name => !review?.checks.some(check => check.name === name && check.required && check.status === "passed"));
  const blocking = state.findings.filter(finding => finding.blocking && (!(["validated", "waived"].includes(finding.state)) || finding.resolvedDeliveryRevision !== state.deliveryRevision));
  if (state.stage === "DONE") return { label: boardCompletion ? "Concluída pelo quadro" : review?.approvalOverride ? "Concluída com exceção" : review?.reservation ? "Concluída com ressalvas" : review?.decidedChannel === "MCP" ? "Concluída pelo agente" : "Concluída", next: "Entrega concluída. Evidências e histórico disponíveis.", tone: "success" as const, agent: review?.decidedChannel === "MCP" ? review.decidedAgent?.trim() || "Assistente conectado" : null, blocking };
  if (state.stage === "IN_REVIEW") {
    if (failed.length) return { label: "Correção pendente", next: `O agente deve corrigir ${failed.join(", ")} e repetir as verificações.`, tone: "warning" as const, agent, blocking };
    if (missing.length || new Set((review?.checks ?? []).map(check => check.name)).size !== (review?.checks.length ?? 0) || review?.checks.some(check => check.required && check.status !== "passed")) return { label: "Verificação pendente", next: "O agente deve executar e registrar todas as verificações obrigatórias.", tone: "warning" as const, agent, blocking };
    if (blocking.length) return { label: "Revisão do agente", next: `O agente deve resolver e validar ${blocking.length} achado(s) bloqueante(s) nesta entrega.`, tone: "warning" as const, agent, blocking };
    return { label: "Revisão do agente", next: "Verificações registradas. O agente deve conferir a revisão e concluir pelo MCP.", tone: "neutral" as const, agent, blocking };
  }
  if (state.stage === "CHANGES_REQUESTED") return { label: "Correção pendente", next: "O agente deve corrigir os achados, repetir as verificações e retomar a revisão.", tone: "warning" as const, agent, blocking };
  if (state.execution?.status === "PAUSED" || state.execution?.status === "WAITING" || (state.stage === "DOING" && state.execution?.status === "FINISHED")) return { label: "Aguardando retomada", next: state.summary?.nextStep || "Retomar a sessão do agente consultando a tarefa e seu histórico.", tone: "neutral" as const, agent, blocking };
  const labels = { BACKLOG: "Backlog", PLANNING: "Planejamento", READY: "Pronta para executar", DOING: "Execução registrada" };
  return { label: labels[state.stage as keyof typeof labels] ?? "Acompanhamento", next: state.summary?.nextStep || "Aguardando o próximo registro de execução.", tone: "neutral" as const, agent, blocking };
}
