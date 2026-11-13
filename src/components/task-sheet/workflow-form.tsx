"use client";

import type { WorkflowFinding } from "@sistema-tasks/contracts";
import { Loader2 } from "lucide-react";
import { SimpleSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { modeTitles, useWorkflowCtx, type WorkflowMode } from "@/components/tasks/task-workflow";

/** Erro e aviso do fluxo, no lugar onde a ação nasceu. */
export function WorkflowFeedback({ scope }: { scope: "now" | "review" }) {
  const flow = useWorkflowCtx();
  if (flow.scope !== scope) return null;
  return <>
    {flow.error && <p role="alert" className="text-sm text-destructive">{flow.error}</p>}
    {flow.notice && <p role="status" className="text-xs text-success">{flow.notice}</p>}
  </>;
}

/**
 * Formulário dos comandos do fluxo (ativar, enviar para revisão, achado, pedir ajuste, correção, dispensa, entrega).
 * Mesmos campos, rótulos e travas de antes; só aparece quando o modo ativo pertence a `modes`.
 */
export function WorkflowForm({ modes }: { modes: WorkflowMode[] }) {
  const flow = useWorkflowCtx();
  const { mode, state, busy } = flow;
  if (!mode || !modes.includes(mode)) return null;
  return (
    <form onSubmit={flow.submit} className="mt-3 space-y-4 border border-border bg-background p-4">
      <h3 className="text-sm font-semibold">{mode === "delivery" && state?.stage === "DONE" ? "Reabrir entrega" : modeTitles[mode]}</h3>
      <fieldset disabled={busy} className="space-y-4">
        {mode !== "fix" && <label className="block space-y-1.5 text-xs"><span>{mode === "init" ? "Contexto da tarefa" : mode === "submit" ? "Resumo do que foi entregue" : mode === "finding" ? "O que precisa ser corrigido" : "Justificativa"}</span><Textarea autoFocus required maxLength={8000} value={flow.text} onChange={(event) => flow.setText(event.target.value)} /></label>}
        {["init", "finding", "delivery"].includes(mode) && <label className="block space-y-1.5 text-xs"><span>{mode !== "finding" ? "Critérios de aceite — um por linha" : "Critério afetado"}</span><Textarea required value={flow.criteria} maxLength={8000} onChange={(event) => flow.setCriteria(event.target.value)} /></label>}
        {(["init", "finding"].includes(mode) || (mode === "submit" && state?.execution?.channel !== "MCP")) && <SimpleSelect label={mode === "submit" ? "Revisor responsável" : "Responsável"} required disabled={busy} value={flow.responsible} onValueChange={flow.setResponsible} placeholder="Selecione um membro" options={Object.entries(flow.members).filter(([id]) => mode !== "submit" || !state?.executorIds.includes(id)).map(([value, label]) => ({ value, label }))} />}
        {["submit", "fix"].includes(mode) && <label className="block space-y-1.5 text-xs"><span>Evidências — uma por linha</span><Textarea required value={flow.evidence} maxLength={16000} onChange={(event) => flow.setEvidence(event.target.value)} /></label>}
        {mode === "submit" && <div className="grid grid-cols-2 gap-3">{Object.entries(flow.checks).map(([name, status]) => <SimpleSelect key={name} label={name} disabled={busy} value={status} onValueChange={(value) => flow.setChecks({ ...flow.checks, [name]: value as "passed" | "failed" | "pending" })} options={[{ value: "pending", label: "Pendente" }, { value: "passed", label: "Passou" }, { value: "failed", label: "Falhou" }]} />)}</div>}
        {mode === "finding" && <div className="flex flex-wrap items-center gap-4"><SimpleSelect label="Severidade" disabled={busy} value={flow.severity} onValueChange={(value) => flow.setSeverity(value as WorkflowFinding["severity"])} options={[{ value: "low", label: "Baixa" }, { value: "medium", label: "Média" }, { value: "high", label: "Alta" }, { value: "critical", label: "Crítica" }]} /><div className="flex items-center gap-2 text-xs"><Input id="workflow-blocking-finding" type="checkbox" checked={flow.blocking} onChange={(event) => flow.setBlocking(event.target.checked)} className="size-4" /><Label htmlFor="workflow-blocking-finding">Bloqueia aprovação</Label></div></div>}
        {mode === "delivery" && <label className="block space-y-1.5 text-xs"><span>Contexto da tarefa</span><Textarea required value={flow.context} maxLength={8000} onChange={(event) => flow.setContext(event.target.value)} /></label>}
        {mode === "delivery" && <p className="text-xs text-muted">Uma nova entrega invalida a aprovação anterior e reabre os achados para revisão.</p>}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" type="submit" className="h-auto min-h-8 max-w-full whitespace-normal py-2 max-md:min-h-11" disabled={busy} aria-busy={busy}>{busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}Registrar</Button>
        <Button size="sm" type="button" variant="ghost" className="max-md:min-h-11" disabled={busy} onClick={flow.cancel}>Cancelar</Button>
      </div>
    </form>
  );
}
