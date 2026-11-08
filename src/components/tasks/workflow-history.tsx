"use client";
import { useState } from "react";
import { useWorkflowHistory } from "@/lib/hooks/use-workflow";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
const channels: Record<string, string> = { WEB: "Painel", MCP: "Assistente conectado", LOCAL_SYNC: "Sincronização local" };
const labels: Record<string, string> = { initialize: "Fluxo ativado", transition: "Etapa alterada", change_delivery: "Entrega atualizada", start_execution: "Execução iniciada", report_progress: "Progresso registrado", record_evidence: "Evidências da entrega registradas", submit_review: "Entrega enviada para revisão", record_finding: "Achado registrado", report_fix: "Correção informada", validate_finding: "Correção validada", waive_finding: "Achado dispensado", request_changes: "Ajustes solicitados", approve_review: "Entrega aprovada", request_action: "Decisão solicitada", resolve_action: "Solicitação respondida" };
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function historyDetails(payload: Record<string, unknown>): string[] {
  const command = object(payload.command);
  const action = object(payload.action);
  const summary = object(command.summary);
  const result: string[] = [];
  const add = (value: unknown, label = "") => { if (typeof value === "string" && value.trim()) result.push(label + value); };
  const list = (value: unknown, label: string) => { if (Array.isArray(value)) value.forEach((item) => add(item, label)); };
  for (const source of [payload, command]) for (const field of ["reason", "description", "question", "response"]) add(source[field]);
  add(action.question); add(action.response);
  add(command.summary); list(command.evidence, "Evidência: ");
  add(summary.objective, "Objetivo: "); list(summary.completed, "Feito: "); list(summary.remaining, "Falta fazer: ");
  list(summary.blockers, "Bloqueio: "); add(summary.nextStep, "Próximo passo: "); list(summary.references, "Referência: ");
  return [...new Set(result)];
}
export function WorkflowHistory({ taskId, members, expanded = false }: { taskId: string; members: Record<string, string>; expanded?: boolean }) {
  const [open, setOpen] = useState(false);
  const query = useWorkflowHistory(taskId, open || expanded);
  const content = <div className="pt-4">{query.isLoading ? <div role="status" aria-label="Carregando histórico"><Skeleton className="h-20 w-full" /></div> : query.isError ? <div role="alert"><p className="text-xs text-muted-foreground">Não foi possível consultar o histórico.</p><Button size="sm" variant="ghost" onClick={() => query.refetch()}>Tentar novamente</Button></div> : <ol className="space-y-4">{query.data?.pages.flatMap((page) => page.events).map((event) => <li key={event.id} className="space-y-1 border-l border-border pl-3"><p className="text-sm">{event.type === "approve_review" && event.channel === "MCP" ? "Concluído pelo assistente" : labels[event.type] ?? "Atualização registrada"}</p><p className="text-xs text-muted-foreground">{members[event.actorId] ?? "Membro do projeto"} · {new Date(event.createdAt).toLocaleString("pt-BR")} · entrega {event.deliveryRevision} · {channels[event.channel] ?? "Canal não informado"}</p>{historyDetails(event.payload ?? {}).map((text, index) => <p key={index} className="whitespace-pre-wrap break-words text-sm">{text}</p>)}</li>)}</ol>}{!query.isError && query.hasNextPage && <Button size="sm" variant="ghost" className="mt-4" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Carregar eventos anteriores</Button>}</div>;
  if (expanded) return <section aria-label="Histórico do fluxo"><h3 className="text-sm font-medium">Histórico do fluxo</h3>{content}</section>;
  return <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="border-t border-border pt-4"><summary className="cursor-pointer rounded text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">Histórico do fluxo</summary>{open && content}</details>;
}
