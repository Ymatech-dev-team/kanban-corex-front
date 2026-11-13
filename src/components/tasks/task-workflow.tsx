"use client";

import { useEffect, useRef, useState } from "react";
import type { WorkflowCommand, WorkflowFinding } from "@sistema-tasks/contracts";
import { CheckCircle2, GitPullRequest, Loader2 } from "lucide-react";
import { useWorkflow, useWorkflowWrite, workflowMessage } from "@/lib/hooks/use-workflow";
import { httpStatus } from "@/lib/http-error";
import { useMe } from "@/lib/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { WorkflowHistory } from "@/components/tasks/workflow-history";
import { WorkflowActions } from "@/components/tasks/workflow-actions";
import { Input } from "@/components/ui/input";
import { workflowPresentation } from "@/lib/workflow-presentation";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const findingStates = { open: "Aberto", fix_reported: "Correção informada", validated: "Validado", waived: "Dispensado com justificativa" };
const decisionLabels = { pending: "Aguardando revisão", changes_requested: "Ajustes solicitados", approved: "Aprovada", superseded: "Entrega substituída" };
const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
type Mode = "init" | "submit" | "finding" | "changes" | "fix" | "waive" | "delivery";
const modeTitles: Record<Mode, string> = { init: "Ativar fluxo nesta tarefa", submit: "Enviar para revisão", finding: "Registrar achado na mesma tarefa", changes: "Solicitar ajustes", fix: "Informar correção", waive: "Dispensar achado", delivery: "Atualizar entrega" };

export function TaskWorkflow({ taskId, query, members, onDirtyChange, view = "all" }: {
  view?: "all" | "summary" | "review" | "history";
  taskId: string; query: ReturnType<typeof useWorkflow>; members: Record<string, string>; onDirtyChange: (dirty: boolean) => void;
}) {
  const me = useMe();
  const write = useWorkflowWrite(taskId);
  const locked = useRef(false);
  const formBase = useRef<{ version: number; cycle?: number } | null>(null);
  const [actionDirty, setActionDirty] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [text, setText] = useState("");
  const [evidence, setEvidence] = useState("");
  const [context, setContext] = useState("");
  const [criteria, setCriteria] = useState("");
  const [responsible, setResponsible] = useState("");
  const [severity, setSeverity] = useState<WorkflowFinding["severity"]>("medium");
  const [blocking, setBlocking] = useState(true);
  const [selectedFinding, setSelectedFinding] = useState("");
  const [checks, setChecks] = useState<Record<string, "passed" | "failed" | "pending">>({ typecheck: "pending", lint: "pending", test: "pending", build: "pending" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => { onDirtyChange(mode !== null || actionDirty); return () => onDirtyChange(false); }, [mode, actionDirty, onDirtyChange]);
  const state = query.data?.state;
  const capabilities = query.data?.capabilities;
  const review = state?.reviews.at(-1);
  const independent = !!me.data && !state?.executorIds.includes(me.data.userId);
  const presentation = state ? workflowPresentation(state) : null;
  const agentReview = review?.reviewMode === "AGENT";
  const reviewing = state?.stage === "IN_REVIEW" && review?.decision === "pending";
  const canReview = capabilities?.canReview && independent && reviewing;
  const busy = write.isPending;
  const checksPassed = !!review && ["typecheck", "lint", "test", "build"].every((name) => review.checks.some((check) => check.name === name && check.required && check.status === "passed")) && !review.checks.some((check) => check.required && check.status !== "passed");

  const unresolvedBlocking = !!state?.findings.some(finding => finding.blocking && (!["validated", "waived"].includes(finding.state) || finding.resolvedDeliveryRevision !== state.deliveryRevision));

  function open(next: Mode, findingId = "") {
    if (mode !== null || locked.current) return;
    formBase.current = state ? { version: state.version, cycle: review?.cycle } : null;
    setMode(next); setSelectedFinding(findingId || crypto.randomUUID()); setText(""); setEvidence(""); setCriteria(""); setResponsible(state?.responsibleId ?? me.data?.userId ?? ""); setError(null); setNotice("");
    setContext(state?.context ?? "");
    if (next === "delivery") setCriteria(state?.criteria.join("\n") ?? "");
    setChecks({ typecheck: "pending", lint: "pending", test: "pending", build: "pending" });
  }
  async function run(command: WorkflowCommand) {
    if (!state || locked.current) return;
    locked.current = true; setError(null);
    try { await write.mutateAsync({ kind: "commands", command, expectedVersion: mode ? formBase.current!.version : state.version }); setMode(null); setNotice("Alteração registrada nesta tarefa."); }
    catch (cause) { setError(workflowMessage(cause)); }
    finally { locked.current = false; }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (locked.current || !mode) return;
    if (mode === "init") {
      locked.current = true; setError(null);
      try { await write.mutateAsync({ kind: "init", values: { responsibleId: responsible, context: text, criteria: lines(criteria) } }); setMode(null); setNotice("Fluxo ativado nesta tarefa."); }
      catch (cause) { setError(workflowMessage(cause)); }
      finally { locked.current = false; }
      return;
    }
    if (mode === "submit") await run({ type: "submit_review", summary: text, evidence: lines(evidence), checks: Object.entries(checks).map(([name, status]) => ({ name, status, required: true })), ...(state?.execution?.channel === "MCP" ? { reviewMode: "AGENT" as const } : { reviewerId: responsible }) });
    if (mode === "finding") await run({ type: "record_finding", id: selectedFinding, description: text, severity, criterion: criteria, responsibleId: responsible, blocking });
    if (mode === "changes" && formBase.current?.cycle) await run({ type: "request_changes", cycle: formBase.current!.cycle!, reason: text });
    if (mode === "fix") await run({ type: "report_fix", findingId: selectedFinding, evidence: lines(evidence) });
    if (mode === "waive" && formBase.current?.cycle) await run({ type: "waive_finding", findingId: selectedFinding, cycle: formBase.current!.cycle!, reason: text });
    if (mode === "delivery") await run({ type: "change_delivery", reason: text, context, criteria: lines(criteria) });
  }
  if (query.isLoading) return <div role="status" aria-label="Carregando fluxo da tarefa" className="space-y-3 border-b border-border py-5"><Skeleton className="h-5 w-40" /><Skeleton className="h-16 w-full" /></div>;
  if (query.isError) {
    if (httpStatus(query.error) === 404) return null;
    return <div role="alert" className="space-y-2 border-b border-border py-4"><p className="text-sm text-muted-foreground">Não foi possível consultar o fluxo desta tarefa.</p><Button variant="secondary" size="sm" disabled={query.isFetching} onClick={() => query.refetch()}>Recarregar fluxo</Button></div>;
  }
  return <section aria-label="Fluxo e revisão da tarefa" className="space-y-5 border-b border-border pb-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-medium"><GitPullRequest className="size-4 text-primary" aria-hidden="true" />{presentation?.label ?? "Fluxo com revisão"}</h2>{state && <span className="text-xs text-muted-foreground">Entrega {state.deliveryRevision} · versão {state.version}</span>}</div>
    {!state ? <div className="space-y-3"><p className="text-sm text-muted-foreground">Concentre execução, evidências e revisão nesta tarefa. Ativar o fluxo passa a controlar a entrega e sua aprovação.</p>{capabilities?.canWrite && !mode && <Button size="sm" variant="secondary" onClick={() => open("init")}>Ativar fluxo</Button>}</div> : <>
      {presentation && <div className="flex flex-col gap-2 rounded-lg border-l-2 border-primary bg-card px-4 py-3"><h3 className="text-sm font-medium">{state.stage === "DONE" ? "Entrega concluída" : "Próximo passo"}</h3><p className="line-clamp-3 break-words text-sm text-muted-foreground">{presentation.next}</p>{agentReview && state.stage !== "DONE" && <p className="text-xs text-muted-foreground">Revisão e conclusão pelo agente. Nenhum aceite final seu é necessário.</p>}</div>}
      <div hidden={view !== "all" && view !== "summary"} className="space-y-5">
      {state.summary ? <div className="space-y-3"><h3 className="text-sm font-medium">Resumo da execução</h3><p className="line-clamp-3 whitespace-pre-wrap break-words text-sm">{state.summary.objective}</p><details className="rounded-lg border border-border p-4"><summary className="cursor-pointer text-sm font-medium">Relatório completo da execução</summary><div className="mt-4 flex flex-col gap-4"><p className="whitespace-pre-wrap break-words text-sm">{state.summary.objective}</p>{([ ["Feito", state.summary.completed], ["Falta fazer", state.summary.remaining], ["Bloqueios", state.summary.blockers], ["Referências", state.summary.references] ] as const).map(([title, items]) => items.length > 0 && <div key={title}><h4 className="mb-1 text-xs text-muted-foreground">{title}</h4><ul className="space-y-1">{items.map((item, index) => <li key={index} className="break-words text-sm">{item}</li>)}</ul></div>)}<p className="text-sm"><span className="text-muted-foreground">Próximo passo: </span>{state.summary.nextStep}</p><p className="text-xs text-muted-foreground">Atualizado por {members[state.summary.updatedBy] ?? "membro do projeto"} · {new Date(state.summary.updatedAt).toLocaleString("pt-BR")} · {state.summary.channel === "MCP" ? "Assistente conectado" : "Painel"}</p></div></details></div> : <p className="text-xs text-muted-foreground">O resumo aparecerá quando houver uma atualização de execução.</p>}
      {state.execution && <p className="text-xs text-muted-foreground">{state.execution.agent} · {{ RUNNING: "Execução registrada", WAITING: "Aguardando", PAUSED: "Pausada", FINISHED: "Execução encerrada" }[state.execution.status]} · última atualização {new Date(state.execution.lastUpdatedAt).toLocaleString("pt-BR")}. O status reflete o último registro recebido.</p>}
      <div><h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Contexto</h3><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{state.context}</p></div>
      <details className="border-t border-border py-3"><summary className="cursor-pointer text-sm font-medium">Critérios de aceite</summary><ul className="mt-3 flex flex-col gap-2">{state.criteria.map((criterion, index) => <li key={index} className="flex items-start gap-2 text-sm"><span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />{criterion}</li>)}</ul></details>
      <p className="text-xs text-muted-foreground">Responsável: {members[state.responsibleId] ?? "Membro do projeto"}</p>
      </div>
      <div hidden={view !== "all" && view !== "review"} className="space-y-5">
      {!review && <p className="text-sm text-muted-foreground">Esta entrega ainda não foi enviada para revisão.</p>}
      {review && <div className="space-y-3 border-t border-border pt-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-medium">Revisão {review.cycle}</h3><span className="text-xs text-muted-foreground">{decisionLabels[review.decision]} · entrega {review.deliveryRevision}</span></div><details className="rounded-lg border border-border p-4"><summary className="cursor-pointer text-sm font-medium">Relatório da revisão e evidências</summary><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{review.summary}</p>{review.decision === "approved" && review.decidedChannel === "MCP" && <p className="break-words text-xs text-muted-foreground">Concluído por {review.decidedAgent?.trim() || "Assistente conectado"} via MCP</p>}<ul className="space-y-1 text-xs text-muted-foreground">{review.evidence.map((item, index) => <li key={index} className="break-words">Evidência: {item}</li>)}</ul></details><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{review.checks.map((check, index) => <div key={index} className="flex flex-col gap-2 rounded-md bg-card p-3"><span className="text-xs font-medium">{check.name}</span><span className={cn("text-xs", check.status === "passed" ? "text-primary" : check.status === "failed" ? "text-destructive" : "text-muted-foreground")}>{check.status === "passed" ? "Passou" : check.status === "failed" ? "Falhou" : "Pendente"}</span></div>)}</div>{review.approvalOverride && <div className="flex flex-col gap-2 rounded-lg border border-border p-4"><h4 className="text-sm font-medium">Aprovada mesmo assim</h4><p className="text-xs text-muted-foreground">Checks e achados foram preservados com seus resultados originais.</p><p className="text-xs text-muted-foreground">{members[review.approvalOverride.approvedBy] ?? "Membro do projeto"} · {new Date(review.approvalOverride.approvedAt).toLocaleString("pt-BR")} · {review.approvalOverride.channel === "MCP" ? "Assistente conectado" : "Painel"} · revisão {review.approvalOverride.cycle} · entrega {review.approvalOverride.deliveryRevision}</p></div>}{review.reservation && <div className="flex flex-col gap-2 rounded-lg border border-border p-4"><h4 className="text-sm font-medium">Ressalva registrada</h4><p className="whitespace-pre-wrap break-words text-sm">{review.reservation.reason}</p><p className="text-xs text-muted-foreground">Checks aceitos com falha: {review.reservation.checkNames.join(", ")}. Os resultados originais foram preservados.</p><p className="text-xs text-muted-foreground">{members[review.reservation.approvedBy] ?? "Membro do projeto"} · {new Date(review.reservation.approvedAt).toLocaleString("pt-BR")} · revisão {review.reservation.cycle} · entrega {review.reservation.deliveryRevision}</p></div>}{review.reason && <p className="text-sm">Decisão: {review.reason}</p>}</div>}
      {!!state.findings.length && <div className="space-y-3"><h3 className="text-sm font-medium">Achados · mesma tarefa</h3><ul className="divide-y divide-border">{state.findings.map((finding) => <li key={finding.id} className="space-y-2 py-3"><div className="flex flex-wrap justify-between gap-2"><span className="text-xs text-muted-foreground">{findingStates[finding.state]}{finding.blocking && ["open", "fix_reported"].includes(finding.state) ? state.stage === "DONE" ? " · bloqueante preservado" : " · bloqueia aprovação regular" : ""}</span><span className="text-xs text-muted-foreground">{members[finding.responsibleId] ?? "Membro do projeto"}</span></div><p className="whitespace-pre-wrap break-words text-sm">{finding.description}</p><p className="text-xs text-muted-foreground">Critério: {finding.criterion}</p>{finding.fixEvidence.map((item, index) => <p key={index} className="break-words text-xs text-muted-foreground">Correção: {item}</p>)}{finding.waiverReason && <p className="text-xs">Justificativa: {finding.waiverReason}</p>}<div className="flex flex-wrap gap-2">{capabilities?.canWrite && ["DOING", "CHANGES_REQUESTED"].includes(state.stage) && finding.state === "open" && <Button size="sm" variant="secondary" disabled={busy || mode !== null} onClick={() => open("fix", finding.id)}>Informar correção</Button>}{canReview && finding.state === "fix_reported" && review && <Button size="sm" variant="secondary" disabled={busy || mode !== null} onClick={() => run({ type: "validate_finding", findingId: finding.id, cycle: review.cycle })}>Validar correção</Button>}{canReview && ["open", "fix_reported"].includes(finding.state) && <Button size="sm" variant="ghost" disabled={busy || mode !== null} onClick={() => open("waive", finding.id)}>Dispensar com motivo</Button>}</div></li>)}</ul></div>}
      {!mode && <div className="flex flex-wrap gap-2">
        {capabilities?.canWrite && state.stage === "DOING" && <Button size="sm" disabled={busy} onClick={() => open("submit")}>Enviar para revisão</Button>}
        {canReview && <><Button size="sm" variant="secondary" onClick={() => open("finding")}>Registrar achado</Button><Button size="sm" variant="secondary" onClick={() => open("changes")}>Solicitar ajustes</Button></>}
        {capabilities?.canApprove && independent && reviewing && !agentReview && review && <Button size="sm" disabled={busy || unresolvedBlocking || !checksPassed} onClick={() => run({ type: "approve_review", cycle: review.cycle })}><CheckCircle2 className="size-4" />Aprovar entrega</Button>}
        {capabilities?.canApprove && reviewing && review && <Button size="sm" variant="outline" disabled={busy} aria-busy={busy} onClick={() => run({ type: "approve_anyway", cycle: review.cycle })}>Aprovar mesmo assim</Button>}
      </div>}
      {reviewing && !checksPassed && <p className="text-xs text-muted-foreground">Aprovar mesmo assim conclui a tarefa, preservando checks falhos ou pendentes e achados bloqueantes no histórico.</p>}
      {!independent && reviewing && !agentReview && <p className="text-xs text-muted-foreground">Quem executou esta entrega pode usar Aprovar mesmo assim. A aprovação regular e a validação dos achados precisam de outro usuário.</p>}
      </div>
      <div hidden={view !== "all" && view !== "summary"} className="space-y-5">
        {!mode && <div className="flex flex-wrap gap-2">
          {capabilities?.canWrite && state.stage === "BACKLOG" && <Button size="sm" disabled={busy} onClick={() => run({ type: "transition", to: "PLANNING" })}>Iniciar planejamento</Button>}
          {capabilities?.canWrite && ["BACKLOG", "PLANNING"].includes(state.stage) && <Button size="sm" variant="secondary" disabled={busy} onClick={() => run({ type: "transition", to: "READY" })}>Pronta para executar</Button>}
          {capabilities?.canWrite && ["READY", "CHANGES_REQUESTED"].includes(state.stage) && <Button size="sm" disabled={busy} onClick={() => run({ type: "transition", to: "DOING" })}>Iniciar execução</Button>}
          {capabilities?.canWrite && (state.stage !== "DONE" || capabilities.canReopen) && <Button size="sm" variant="ghost" disabled={busy} onClick={() => open("delivery")}>{state.stage === "DONE" ? "Reabrir entrega" : "Atualizar entrega"}</Button>}
        </div>}
        {query.data && <WorkflowActions taskId={taskId} snapshot={query.data} members={members} onDirtyChange={setActionDirty} />}
      </div>
      <div hidden={view !== "all" && view !== "history"}><WorkflowHistory taskId={taskId} members={members} expanded={view === "history"} /></div>
    </>}
    {mode && <form hidden={view !== "all" && view !== (["init", "delivery"].includes(mode) ? "summary" : "review")} onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-background p-4"><h3 className="text-sm font-medium">{mode === "delivery" && state?.stage === "DONE" ? "Reabrir entrega" : modeTitles[mode]}</h3><fieldset disabled={busy} className="space-y-4">
      {mode !== "fix" && <label className="block space-y-1.5 text-xs"><span>{mode === "init" ? "Contexto da tarefa" : mode === "submit" ? "Resumo do que foi entregue" : mode === "finding" ? "O que precisa ser corrigido" : "Justificativa"}</span><Textarea autoFocus required maxLength={8000} value={text} onChange={(event) => setText(event.target.value)} /></label>}
      {["init", "finding", "delivery"].includes(mode) && <label className="block space-y-1.5 text-xs"><span>{mode !== "finding" ? "Critérios de aceite — um por linha" : "Critério afetado"}</span><Textarea required value={criteria} maxLength={8000} onChange={(event) => setCriteria(event.target.value)} /></label>}
      {(["init", "finding"].includes(mode) || (mode === "submit" && state?.execution?.channel !== "MCP")) && <label className="block space-y-1.5 text-xs"><span>{mode === "submit" ? "Revisor responsável" : "Responsável"}</span><select required value={responsible} onChange={(event) => setResponsible(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecione um membro</option>{Object.entries(members).filter(([id]) => mode !== "submit" || !state?.executorIds.includes(id)).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>}
      {["submit", "fix"].includes(mode) && <label className="block space-y-1.5 text-xs"><span>Evidências — uma por linha</span><Textarea required value={evidence} maxLength={16000} onChange={(event) => setEvidence(event.target.value)} /></label>}
      {mode === "submit" && <div className="grid grid-cols-2 gap-3">{Object.entries(checks).map(([name, status]) => <label key={name} className="space-y-1 text-xs"><span>{name}</span><select value={status} onChange={(event) => setChecks({ ...checks, [name]: event.target.value as "passed" | "failed" | "pending" })} className="h-9 w-full rounded-md border border-input bg-background px-2"><option value="pending">Pendente</option><option value="passed">Passou</option><option value="failed">Falhou</option></select></label>)}</div>}
      {mode === "finding" && <div className="flex flex-wrap items-center gap-4"><label className="text-xs">Severidade<select value={severity} onChange={(event) => setSeverity(event.target.value as WorkflowFinding["severity"])} className="ml-2 rounded border border-input bg-background p-2"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label><label className="flex items-center gap-2 text-xs"><Input type="checkbox" checked={blocking} onChange={(event) => setBlocking(event.target.checked)} className="size-4" />Bloqueia aprovação</label></div>}
      {mode === "delivery" && <label className="block space-y-1.5 text-xs"><span>Contexto da tarefa</span><Textarea required value={context} maxLength={8000} onChange={(event) => setContext(event.target.value)} /></label>}
      {mode === "delivery" && <p className="text-xs text-muted-foreground">Uma nova entrega invalida a aprovação anterior e reabre os achados para revisão.</p>}
    </fieldset><div className="flex flex-wrap gap-2"><Button size="sm" type="submit" className="h-auto min-h-8 max-w-full whitespace-normal py-2" disabled={busy} aria-busy={busy}>{busy && <Loader2 className="size-4 animate-spin" />}Registrar</Button><Button size="sm" type="button" variant="ghost" disabled={busy} onClick={() => { setMode(null); setError(null); }}>Cancelar</Button></div></form>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{notice && <p role="status" className="text-xs text-primary">{notice}</p>}
  </section>;
}
