"use client";

import type { WorkflowReview } from "@sistema-tasks/contracts";
import { Toolbar } from "@heroui/react";
import { Button } from "@/components/ui/button";
import { ChecksStrip, SectionHeader, Stamp } from "@/components/live";
import { useWorkflowCtx } from "@/components/tasks/task-workflow";
import { cn } from "@/lib/utils";
import { CHANNEL_LABEL } from "./channel";
import { Fold } from "./fold";
import { formatStamp } from "./diary-model";
import { SHEET_SECTIONS } from "./sections";
import { WorkflowFeedback, WorkflowForm } from "./workflow-form";

const findingStates = { open: "Aberto", fix_reported: "Correção informada", validated: "Validado", waived: "Dispensado com justificativa" };
const decisionLabels = { pending: "Aguardando revisão", changes_requested: "Ajustes solicitados", approved: "Aprovada", superseded: "Entrega substituída" };
const SEVERITY = { low: { text: "baixa", tone: "text-muted" }, medium: { text: "média", tone: "text-warning" }, high: { text: "alta", tone: "text-danger" }, critical: { text: "crítica", tone: "text-danger" } } as const;

/** "Nome · DD/MM HH:MM · canal" do carimbo; só mostra o que foi gravado. */
function stampLine(who: string, at: string | undefined, channel: keyof typeof CHANNEL_LABEL | undefined): string {
  return [who, at ? formatStamp(at) : null, channel ? CHANNEL_LABEL[channel] : null].filter(Boolean).join(" · ");
}

function DecisionStamps({ review, members }: { review: WorkflowReview; members: Record<string, string> }) {
  const name = (id: string | undefined) => (id && members[id]) || "Membro do projeto";
  const agentName = review.decidedAgent?.trim() || "Assistente conectado";
  if (review.approvalOverride) {
    const o = review.approvalOverride;
    return <Stamp tone="warn" title="Aprovada mesmo assim">{stampLine(name(o.approvedBy), o.approvedAt, o.channel)}</Stamp>;
  }
  if (review.reservation) {
    const r = review.reservation;
    return <Stamp tone="warn" title="Ressalva registrada">{stampLine(name(r.approvedBy), r.approvedAt, undefined)}</Stamp>;
  }
  if (review.decision === "approved") {
    return <Stamp title="Aprovada">{stampLine(review.decidedChannel === "MCP" ? agentName : name(review.decidedBy), review.decidedAt, review.decidedChannel)}</Stamp>;
  }
  if (review.decision === "changes_requested") {
    return <Stamp tone="warn" title="Ajustes pedidos">{stampLine(review.decidedChannel === "MCP" ? agentName : name(review.decidedBy), review.decidedAt, review.decidedChannel)}</Stamp>;
  }
  return <span className="text-xs text-muted">{decisionLabels[review.decision]}</span>;
}

/**
 * Revisão (RF32): ciclo e entrega, os checks em células mono, achados, ações e as decisões como carimbo.
 * As condições de Aprovar / Pedir ajuste / Aprovar mesmo assim vêm de `reviewRules`, as mesmas de sempre (RNF2).
 */
export function SheetReview() {
  const flow = useWorkflowCtx();
  const { state, capabilities, rules, busy, mode, members } = flow;
  if (!state) return null;
  const { review, canReview } = rules;
  const canWrite = !!capabilities?.canWrite;
  const canSubmit = canWrite && state.stage === "DOING";
  const showApprove = rules.showApprove && !!review;
  const showApproveAnyway = rules.showApproveAnyway && !!review;
  const hasActions = canSubmit || canReview || showApprove || showApproveAnyway;
  const blockingMark = (finding: (typeof state.findings)[number]) => finding.blocking && ["open", "fix_reported"].includes(finding.state) ? (state.stage === "DONE" ? " · bloqueante preservado" : " · bloqueia aprovação regular") : null;
  return (
    <section id={SHEET_SECTIONS.review.id} aria-labelledby={`${SHEET_SECTIONS.review.id}-title`} tabIndex={-1} className="scroll-mt-20 outline-none">
      <SectionHeader id={`${SHEET_SECTIONS.review.id}-title`} title="Revisão" right={review ? <span className="mono">ciclo {review.cycle} · entrega {review.deliveryRevision}</span> : <span className="mono">entrega {state.deliveryRevision}</span>} />
      {!review && <p className="text-sm text-muted">Esta entrega ainda não foi enviada para revisão.</p>}
      {review && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-1">
            <ChecksStrip checks={review.checks} />
            <DecisionStamps review={review} members={members} />
          </div>
          {review.approvalOverride && <p className="text-xs text-muted">Checks e achados foram preservados com seus resultados originais.</p>}
          {review.reservation && (
            <div className="space-y-1">
              <p className="whitespace-pre-wrap break-words text-sm">{review.reservation.reason}</p>
              <p className="text-xs text-muted">Checks aceitos com falha: {review.reservation.checkNames.join(", ")}. Os resultados originais foram preservados.</p>
            </div>
          )}
          {review.reason && <p className="break-words text-sm">Decisão: {review.reason}</p>}
          <Fold title="Relatório da revisão e evidências">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{review.summary}</p>
            {review.decision === "approved" && review.decidedChannel === "MCP" && <p className="mt-2 break-words text-xs text-muted">Concluído por {review.decidedAgent?.trim() || "Assistente conectado"} via MCP</p>}
            <ul className="mt-2 space-y-1 text-xs text-muted">{review.evidence.map((item, index) => <li key={index} className="break-words">Evidência: {item}</li>)}</ul>
          </Fold>
        </div>
      )}

      {!!state.findings.length && (
        <div className="mt-4">
          <table className="w-full border-collapse text-[13px]">
            <caption className="sr-only">Achados da revisão, na mesma tarefa</caption>
            <thead className="max-md:sr-only">
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-[.06em] text-muted">
                <th scope="col" className="px-2 py-1.5">Achado</th>
                <th scope="col" className="px-2 py-1.5">Sev.</th>
                <th scope="col" className="px-2 py-1.5">Bloqueia</th>
                <th scope="col" className="px-2 py-1.5">Estado</th>
                <th scope="col" className="px-2 py-1.5">Responsável</th>
              </tr>
            </thead>
            <tbody>
              {state.findings.map((finding) => (
                <tr key={finding.id} className="border-b border-border align-top max-md:block max-md:py-2">
                  <td className="space-y-1 px-2 py-2.5 max-md:block max-md:py-0.5">
                    <p className="whitespace-pre-wrap break-words">{finding.description}</p>
                    <p className="text-xs text-muted">Critério: {finding.criterion}</p>
                    {finding.fixEvidence.map((item, index) => <p key={index} className="break-words text-xs text-muted">Correção: {item}</p>)}
                    {finding.waiverReason && <p className="text-xs">Justificativa: {finding.waiverReason}</p>}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {canWrite && ["DOING", "CHANGES_REQUESTED"].includes(state.stage) && finding.state === "open" && <Button size="sm" variant="secondary" className="max-md:min-h-11" disabled={busy || mode !== null} onClick={() => flow.open("fix", finding.id)}>Informar correção</Button>}
                      {canReview && finding.state === "fix_reported" && review && <Button size="sm" variant="secondary" className="max-md:min-h-11" disabled={busy || mode !== null} onClick={() => flow.run({ type: "validate_finding", findingId: finding.id, cycle: review.cycle })}>Validar correção</Button>}
                      {canReview && ["open", "fix_reported"].includes(finding.state) && <Button size="sm" variant="ghost" className="max-md:min-h-11" disabled={busy || mode !== null} onClick={() => flow.open("waive", finding.id)}>Dispensar com motivo</Button>}
                    </div>
                  </td>
                  <td className={cn("mono px-2 py-2.5 text-[11px] font-medium max-md:block max-md:py-0.5", SEVERITY[finding.severity]?.tone)}><span className="md:sr-only">Severidade: </span>{SEVERITY[finding.severity]?.text ?? finding.severity}</td>
                  <td className="px-2 py-2.5 max-md:block max-md:py-0.5"><span className="md:sr-only">Bloqueia aprovação: </span>{finding.blocking ? "sim" : "não"}</td>
                  <td className="px-2 py-2.5 max-md:block max-md:py-0.5"><span>{findingStates[finding.state]}</span>{blockingMark(finding) && <span className="text-muted">{blockingMark(finding)}</span>}</td>
                  <td className="px-2 py-2.5 text-muted max-md:block max-md:py-0.5">{members[finding.responsibleId] ?? "Membro do projeto"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!mode && hasActions && (
        <Toolbar aria-label="Ações da revisão" className="mt-3 flex flex-wrap gap-2">
          {canSubmit && <Button size="sm" className="max-md:min-h-11" disabled={busy} onClick={() => flow.open("submit")}>Enviar para revisão</Button>}
          {canReview && <><Button size="sm" variant="secondary" className="max-md:min-h-11" onClick={() => flow.open("finding")}>Registrar achado</Button><Button size="sm" variant="secondary" className="max-md:min-h-11" onClick={() => flow.open("changes")}>Pedir ajuste</Button></>}
          {showApprove && review && <Button size="sm" className="max-md:min-h-11" disabled={busy || rules.approveBlocked} aria-describedby={rules.approveBlocked ? "sheet-approve-reason" : undefined} onClick={() => flow.run({ type: "approve_review", cycle: review.cycle })}>Aprovar</Button>}
          {showApproveAnyway && review && <Button size="sm" variant="outline" className="max-md:min-h-11" disabled={busy} aria-busy={busy} onClick={() => flow.run({ type: "approve_anyway", cycle: review.cycle })}>Aprovar mesmo assim</Button>}
        </Toolbar>
      )}
      {rules.showApprove && rules.approveBlocked && <p id="sheet-approve-reason" className="mt-2 text-xs text-muted">Aprovar fica indisponível: algum check não passou ou há achado bloqueante aberto.</p>}
      {rules.showOverrideHint && <p className="mt-2 text-xs text-muted">Aprovar mesmo assim conclui a tarefa, preservando checks falhos ou pendentes e achados bloqueantes no histórico.</p>}
      {rules.showIndependenceHint && <p className="mt-2 text-xs text-muted">Quem executou esta entrega pode usar Aprovar mesmo assim. A aprovação regular e a validação dos achados precisam de outro usuário.</p>}
      <WorkflowForm modes={["submit", "finding", "changes", "fix", "waive"]} />
      <div className="mt-2 space-y-1"><WorkflowFeedback scope="review" /></div>
    </section>
  );
}
