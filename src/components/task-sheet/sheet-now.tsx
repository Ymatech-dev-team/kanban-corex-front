"use client";

import { useState, type ReactNode } from "react";
import { Toolbar } from "@heroui/react";
import type { LiveStatus } from "@/lib/live-status";
import type { WorkflowAction } from "@/lib/hooks/use-workflow";
import { Button } from "@/components/ui/button";
import { SectionHeader, SignalTime, StatusMark } from "@/components/live";
import { ActionResponse } from "@/components/agora/action-response";
import { WorkflowActions, isMyDecision } from "@/components/tasks/workflow-actions";
import { useWorkflowCtx } from "@/components/tasks/task-workflow";
import { cn } from "@/lib/utils";
import { WorkflowForm, WorkflowFeedback } from "./workflow-form";
import { CHANNEL_LABEL } from "./channel";
import { SHEET_SECTIONS, scrollToSection } from "./sections";

const ALERT_KINDS = ["silent", "blocked", "changes", "you"] as const;

/** Segunda linha da caixa: "Fazendo agora" enquanto trabalha ou planeja; "Parou porque" quando o motivo é de parada. */
function middleRow(live: LiveStatus, askedAbove: boolean): { label: string; text: string; hint?: string } {
  switch (live.kind) {
    case "running":
    case "planning":
      return { label: "Fazendo agora", text: live.doing ?? "O agente ainda não relatou o que está fazendo." };
    case "done":
      return { label: "Fazendo agora", text: "Nada em andamento: a entrega foi concluída." };
    case "silent":
      return { label: "Parou porque", text: live.reason ?? "Sem notícia do agente.", hint: live.doing ? `Última tarefa conhecida: ${live.doing}` : undefined };
    case "review":
      return { label: "Parou porque", text: "A entrega aguarda revisão." };
    case "paused":
      return { label: "Parou porque", text: live.sentence };
    case "you":
      return { label: "Parou porque", text: askedAbove ? "Aguarda a sua decisão para seguir." : live.reason ?? live.sentence };
    default:
      return { label: "Parou porque", text: live.reason ?? live.sentence };
  }
}

function Row({ label, tone, children, className }: { label: string; tone?: "alert"; children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-x-3 gap-y-1 border-b border-border px-3.5 py-3 last:border-b-0 md:grid-cols-[132px_minmax(0,1fr)]", className)}>
      <span className={cn("pt-0.5 text-[11px] font-semibold uppercase tracking-[.06em]", tone === "alert" ? "text-warning" : "text-muted")}>{label}</span>
      <div className="min-w-0 break-words text-sm">{children}</div>
    </div>
  );
}

/**
 * Agora (RF30): decisão pedida a você no topo, e três linhas fixas — Estado, Fazendo agora / Parou porque, Próximo passo.
 * Também reúne as ações de etapa do fluxo (iniciar planejamento, pronta, iniciar execução, atualizar entrega) e os pedidos abertos.
 */
export function SheetNow({ taskTitle, live }: { taskTitle: string; live: LiveStatus }) {
  const flow = useWorkflowCtx();
  const { state, capabilities, query, busy, mode, rules } = flow;
  // Pedido em que o usuário já interagiu fica montado com o objeto que ele viu: `useWorkflowWrite` refaz o snapshot ANTES de a
  // mutação resolver, o pedido sai da lista e o recibo ("Resposta registrada…" + copiar pedido de retomada) sumiria. [RF8, RF30]
  const [engaged, setEngaged] = useState<Record<string, WorkflowAction>>({});
  if (!state || !query.data) return null;
  const open = query.data.actions.filter((action) => isMyDecision(action, flow.userId));
  const mine = [...open, ...Object.values(engaged).filter((kept) => !open.some((action) => action.id === kept.id))];
  const engage = (action: WorkflowAction) => setEngaged((prev) => (prev[action.id] ? prev : { ...prev, [action.id]: action }));
  const reviewForMe = query.data.actions.some((action) => action.kind === "REVIEW" && action.recipientId === flow.userId);
  const middle = middleRow(live, mine.length > 0 || reviewForMe);
  const execution = state.execution;
  const canWrite = !!capabilities?.canWrite;
  const alert = (ALERT_KINDS as readonly string[]).includes(live.kind);
  return (
    <section id={SHEET_SECTIONS.now.id} aria-labelledby={`${SHEET_SECTIONS.now.id}-title`} tabIndex={-1} className="scroll-mt-20 outline-none">
      <SectionHeader id={`${SHEET_SECTIONS.now.id}-title`} title="Agora" alert={alert} className="mb-2.5" />
      <div className="border border-foreground">
        {mine.map((action) => (
          <div key={action.id} onClickCapture={() => engage(action)} onSubmitCapture={() => engage(action)} className="border-b border-warning bg-warning/10 px-3.5 py-3 last:border-b-0 md:grid md:grid-cols-[132px_minmax(0,1fr)] md:gap-x-3">
            <span className="pt-0.5 text-[11px] font-semibold uppercase tracking-[.06em] text-warning">Espera você</span>
            <div className="min-w-0">
              <p className="whitespace-pre-wrap break-words text-sm font-semibold">{action.question}</p>
              <div className="mt-2.5">
                <ActionResponse taskId={flow.taskId} taskTitle={taskTitle} action={action} compact={false} />
              </div>
            </div>
          </div>
        ))}
        {reviewForMe && (
          <Row label="Espera você" tone="alert" className="border-warning bg-warning/10">
            <span className="font-semibold">Decisão da revisão desta entrega.</span>{" "}
            <Button variant="unstyled" type="button" className="underline underline-offset-2 max-md:min-h-11" onClick={() => scrollToSection(SHEET_SECTIONS.review.id)}>Ir para Revisão</Button>
          </Row>
        )}
        <Row label="Estado">
          <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <StatusMark kind={live.kind} label={live.label} />
            {live.sentence !== live.label && live.kind !== "silent" && live.kind !== "you" && <span className="text-muted">{live.sentence}</span>}
            {execution && <span className="text-muted">· {execution.agent} · {CHANNEL_LABEL[execution.channel]}</span>}
            {live.lastSignalAt && <span className="whitespace-nowrap text-muted">· último sinal <SignalTime iso={live.lastSignalAt} alert={live.kind === "silent"} /></span>}
          </span>
        </Row>
        <Row label={middle.label}>
          {middle.text}
          {middle.hint && <span className="mt-1 block text-[13px] text-muted">{middle.hint}</span>}
        </Row>
        <Row label="Próximo passo">{state.stage === "DONE" ? <><span aria-hidden="true" className="text-muted">—</span><span className="sr-only">Nenhum: a tarefa foi concluída</span></> : live.next ?? <span className="text-muted">Nenhum próximo passo informado.</span>}</Row>
      </div>
      {rules.agentReview && state.stage !== "DONE" && <p className="mt-2 text-xs text-muted">Revisão e conclusão pelo agente. Nenhum aceite final seu é necessário.</p>}

      {!mode && canWrite && (
        <Toolbar aria-label="Mover etapa do fluxo" className="mt-3 flex flex-wrap gap-2">
          {state.stage === "BACKLOG" && <Button size="sm" className="max-md:min-h-11" disabled={busy} onClick={() => flow.run({ type: "transition", to: "PLANNING" }, "now")}>Iniciar planejamento</Button>}
          {["BACKLOG", "PLANNING"].includes(state.stage) && <Button size="sm" variant="secondary" className="max-md:min-h-11" disabled={busy} onClick={() => flow.run({ type: "transition", to: "READY" }, "now")}>Pronta para executar</Button>}
          {["READY", "CHANGES_REQUESTED"].includes(state.stage) && <Button size="sm" className="max-md:min-h-11" disabled={busy} onClick={() => flow.run({ type: "transition", to: "DOING" }, "now")}>Iniciar execução</Button>}
          {(state.stage !== "DONE" || capabilities?.canReopen) && <Button size="sm" variant="ghost" className="max-md:min-h-11" disabled={busy} onClick={() => flow.open("delivery")}>{state.stage === "DONE" ? "Reabrir entrega" : "Atualizar entrega"}</Button>}
        </Toolbar>
      )}
      <WorkflowForm modes={["delivery"]} />
      <div className="mt-2 space-y-1"><WorkflowFeedback scope="now" /></div>
      <div className="mt-4">
        <WorkflowActions taskId={flow.taskId} snapshot={query.data} members={flow.members} onDirtyChange={flow.setActionDirty} />
      </div>
    </section>
  );
}
