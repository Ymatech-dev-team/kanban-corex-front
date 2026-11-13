"use client";

import type { LiveStatus } from "@/lib/live-status";
import { SectionHeader, StepRuler } from "@/components/live";
import { useWorkflowCtx } from "@/components/tasks/task-workflow";
import { cn } from "@/lib/utils";
import { CHANNEL_LABEL } from "./channel";
import { Fold } from "./fold";
import { SHEET_SECTIONS } from "./sections";

type Step = { text: string; mark: "done" | "now" | "todo" };

/**
 * Lista de passos a partir do relato do agente: feitos (riscados), o atual e os restantes.
 * O atual é o `nextStep` quando ele está em `remaining`; senão, o primeiro de `remaining`. Sem execução em andamento
 * (tarefa concluída) não há passo atual.
 */
export function buildSteps(completed: string[], remaining: string[], nextStep: string, finished: boolean): Step[] {
  const currentIndex = finished || !remaining.length ? -1 : Math.max(0, remaining.indexOf(nextStep));
  return [
    ...completed.map((text): Step => ({ text, mark: "done" })),
    ...remaining.map((text, index): Step => ({ text, mark: index === currentIndex ? "now" : "todo" })),
  ];
}

const MARK_BOX: Record<Step["mark"], string> = {
  done: "border-accent bg-accent",
  now: "border-foreground bg-foreground shadow-[inset_0_0_0_2px_var(--background)]",
  todo: "border-muted bg-transparent",
};

/**
 * Passos (RF31): objetivo, passos feitos riscados, o atual marcado "agora" (ou "bloqueado"), restantes vazios,
 * "n de total" e bloqueios. Sem relato do agente, diz isso e mostra o critério de aceite — não finge progresso.
 */
export function SheetSteps({ live }: { live: LiveStatus }) {
  const flow = useWorkflowCtx();
  const { state, members } = flow;
  if (!state) return null;
  const summary = state.summary;
  const steps = summary ? buildSteps(summary.completed, summary.remaining, summary.nextStep, state.stage === "DONE") : [];
  const total = steps.length;
  const done = summary?.completed.length ?? 0;
  const blocked = !!summary?.blockers.length;
  return (
    <section id={SHEET_SECTIONS.steps.id} aria-labelledby={`${SHEET_SECTIONS.steps.id}-title`} tabIndex={-1} className="scroll-mt-20 outline-none">
      <SectionHeader
        id={`${SHEET_SECTIONS.steps.id}-title`}
        title="Passos"
        right={summary && total > 0 ? <span className="inline-flex items-center gap-3"><span className="mono">{done} de {total}</span><StepRuler done={done} total={total} kind={live.kind} hideCount /></span> : undefined}
      />
      {!summary ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">O agente ainda não relatou passos.</p>
          {state.criteria.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.06em] text-muted">Critério de aceite</h3>
              <ul className="space-y-1">{state.criteria.map((criterion, index) => <li key={index} className="flex items-baseline gap-2 break-words text-sm"><span aria-hidden="true" className="mt-1 inline-block size-2 shrink-0 border-[1.5px] border-muted" />{criterion}</li>)}</ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="break-words text-sm"><span className="text-muted">Objetivo · </span>{summary.objective}</p>
          {total > 0 ? (
            <ol className="m-0 list-none space-y-1 p-0 text-sm">
              {steps.map((step, index) => (
                <li key={index} data-step={step.mark} className={cn("flex items-baseline gap-2.5", step.mark === "done" && "text-muted line-through decoration-accent decoration-2", step.mark === "now" && "font-bold")}>
                  <span aria-hidden="true" className={cn("inline-block size-[9px] shrink-0 translate-y-px border-[1.5px]", MARK_BOX[step.mark])} />
                  <span className="min-w-0 break-words">
                    {step.text}
                    {step.mark === "done" && <span className="sr-only"> (feito)</span>}
                    {step.mark === "now" && <em className={cn("mono ml-1.5 text-[11px] font-medium not-italic", blocked ? "text-danger" : "text-success")}>{blocked ? "agora · bloqueado" : "agora"}</em>}
                  </span>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-muted">O agente ainda não relatou passos.</p>}
          {blocked && (
            <ul aria-label="Bloqueios" className="m-0 list-none space-y-0.5 p-0 text-sm font-semibold text-danger">
              {summary.blockers.map((blocker, index) => <li key={index} className="break-words">Bloqueio · {blocker}</li>)}
            </ul>
          )}
          <Fold title="Relatório completo da execução">
            <div className="flex flex-col gap-3">
              {summary.references.length > 0 && <div><h4 className="mb-1 text-xs text-muted">Referências</h4><ul className="space-y-1">{summary.references.map((item, index) => <li key={index} className="break-words text-sm">{item}</li>)}</ul></div>}
              <p className="text-xs text-muted">Atualizado por {members[summary.updatedBy] ?? "membro do projeto"} · <span className="mono">{new Date(summary.updatedAt).toLocaleString("pt-BR")}</span> · {CHANNEL_LABEL[summary.channel]}</p>
            </div>
          </Fold>
        </div>
      )}
    </section>
  );
}
