"use client";

import { useMemo, type ReactNode } from "react";
import { httpStatus } from "@/lib/http-error";
import { deriveLiveStatus } from "@/lib/live-status";
import { useNow } from "@/lib/hooks/use-now";
import { useMe } from "@/lib/hooks/use-me";
import type { useWorkflow } from "@/lib/hooks/use-workflow";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkflowProvider, useWorkflowCtx } from "@/components/tasks/task-workflow";
import { cn } from "@/lib/utils";
import { SheetDiary } from "./sheet-diary";
import { SheetFile } from "./sheet-file";
import { SheetIndex, useActiveSection } from "./sheet-index";
import { SheetNow } from "./sheet-now";
import { SheetReview } from "./sheet-review";
import { SheetSteps } from "./sheet-steps";
import { SHEET_SECTIONS } from "./sections";
import { WorkflowFeedback, WorkflowForm } from "./workflow-form";

type Query = ReturnType<typeof useWorkflow>;

/** Tarefa sem fluxo (RF35): a ação existente de ativar o fluxo, sem seções vazias de Passos e Revisão. */
function NoFlowPanel({ locked }: { locked: boolean }) {
  const flow = useWorkflowCtx();
  return (
    <fieldset disabled={locked} className="min-w-0 space-y-2 border border-border p-4">
      <legend className="px-1 text-sm font-semibold">Fluxo com revisão</legend>
      <p className="text-sm text-muted">Concentre execução, evidências e revisão nesta tarefa. Ativar o fluxo passa a controlar a entrega e sua aprovação.</p>
      {flow.capabilities?.canWrite && !flow.mode && <Button size="sm" variant="secondary" className="max-md:min-h-11" onClick={() => flow.open("init")}>Ativar fluxo</Button>}
      <WorkflowForm modes={["init"]} />
      <WorkflowFeedback scope="now" />
      {locked && <p className="text-xs text-muted">Salve ou descarte a edição dos campos antes de alterar o fluxo.</p>}
    </fieldset>
  );
}

/**
 * Folha da tarefa (RF28): rolagem única com Agora, Passos, Revisão, Diário e Ficha, e índice fixo à direita.
 * Sem abas. `header` e a Ficha (`file`) vêm de `TaskDetailView`, dono dos dados, da edição e da guarda de rascunho.
 * Com fluxo: Agora, Passos, Revisão, Diário, Ficha (recolhida). Sem fluxo: Ficha (aberta) e Diário, sem Passos/Revisão.
 */
export function TaskSheet({ taskId, taskTitle, taskUpdatedAt, workflow, members, panel = false, onWorkflowDirtyChange, flowLocked = false, header, file, fileOpen, onFileOpenChange }: {
  taskId: string;
  taskTitle: string;
  taskUpdatedAt: string | undefined;
  workflow: Query;
  members: Record<string, string>;
  panel?: boolean;
  onWorkflowDirtyChange: (dirty: boolean) => void;
  /** Edição de campos em aberto: o fluxo fica travado até salvar ou descartar. */
  flowLocked?: boolean;
  header: ReactNode;
  file: ReactNode;
  fileOpen: boolean;
  onFileOpenChange: (open: boolean) => void;
}) {
  // Com erro de consulta, o snapshot (talvez velho) não aparece: some o estado do fluxo e fica o aviso. [segurança, igual a antes]
  const safe = workflow.isError ? ({ ...workflow, data: undefined } as Query) : workflow;
  return (
    <WorkflowProvider taskId={taskId} query={safe} members={members} onDirtyChange={onWorkflowDirtyChange}>
      <SheetBody {...{ taskId, taskTitle, taskUpdatedAt, workflow: safe, members, panel, flowLocked, header, file, fileOpen, onFileOpenChange }} />
    </WorkflowProvider>
  );
}

function SheetBody({ taskId, taskTitle, taskUpdatedAt, workflow, members, panel, flowLocked, header, file, fileOpen, onFileOpenChange }: {
  taskId: string; taskTitle: string; taskUpdatedAt: string | undefined; workflow: Query; members: Record<string, string>; panel: boolean;
  flowLocked: boolean; header: ReactNode; file: ReactNode; fileOpen: boolean; onFileOpenChange: (open: boolean) => void;
}) {
  const me = useMe();
  const now = useNow(30_000);
  const state = workflow.data?.state ?? null;
  const managed = !!state;
  const unavailable = workflow.isError && httpStatus(workflow.error) === 404; // sem fluxo neste ambiente: nada a ativar
  const failed = workflow.isError && !unavailable;

  const live = useMemo(() => {
    if (!state || !workflow.data) return null;
    const mine = workflow.data.actions.find((action) => action.recipientId === me.data?.userId && (action.state ?? "OPEN") === "OPEN");
    return deriveLiveStatus({
      state,
      updatedAt: state.summary?.updatedAt ?? state.execution?.lastUpdatedAt ?? taskUpdatedAt ?? new Date(0).toISOString(),
      responsibleName: members[state.responsibleId] ?? null,
      openActionForMe: mine ? { kind: mine.kind, question: mine.question } : null,
    }, now);
  }, [state, workflow.data, me.data?.userId, members, taskUpdatedAt, now]);

  const sections = useMemo(() => (managed
    ? [SHEET_SECTIONS.now, SHEET_SECTIONS.steps, SHEET_SECTIONS.review, SHEET_SECTIONS.diary, SHEET_SECTIONS.file]
    : [SHEET_SECTIONS.file, SHEET_SECTIONS.diary]), [managed]);
  const ids = useMemo(() => sections.map((section) => section.id), [sections]);
  const active = useActiveSection(ids);

  const diary = <SheetDiary key="diary" taskId={taskId} membersById={members} managed={managed} />;
  const fileSection = <SheetFile key="file" open={fileOpen} onOpenChange={onFileOpenChange}>{file}</SheetFile>;

  return (
    <div className={cn("grid gap-x-8", panel ? "lg:grid-cols-[minmax(0,1fr)_112px]" : "lg:grid-cols-[minmax(0,1fr)_168px] lg:gap-x-10")}>
      <div className="min-w-0 space-y-9">
        {header}
        {workflow.isLoading && <div role="status" aria-label="Carregando fluxo da tarefa" className="space-y-3"><Skeleton className="h-5 w-40" /><Skeleton className="h-16 w-full" /></div>}
        {failed && (
          <div role="alert" className="space-y-2 border border-border p-4">
            <p className="text-sm text-muted">Não foi possível consultar o fluxo desta tarefa.</p>
            <Button variant="secondary" size="sm" className="max-md:min-h-11" disabled={workflow.isFetching} onClick={() => workflow.refetch()}>Recarregar fluxo</Button>
          </div>
        )}
        {managed && live ? (
          <>
            <SheetNow taskTitle={taskTitle} live={live} />
            <SheetSteps live={live} />
            <SheetReview />
            {diary}
            {fileSection}
          </>
        ) : (
          <>
            {!workflow.isLoading && !failed && !unavailable && <NoFlowPanel locked={flowLocked} />}
            {fileSection}
            {diary}
          </>
        )}
      </div>
      <SheetIndex sections={sections} activeId={active} />
    </div>
  );
}
