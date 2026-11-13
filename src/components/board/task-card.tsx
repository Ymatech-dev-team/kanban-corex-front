"use client";

import { createContext, useContext, useId, type ReactNode } from "react";
import { Card } from "@heroui/react";
import { Button } from "@/components/ui/button";
import type { Task } from "@/lib/types";
import type { TaskPriority } from "@sistema-tasks/contracts";
import { initials } from "@/lib/initials";
import { dueTag } from "@/lib/due";
import type { LiveStatus } from "@/lib/live-status";
import { SignalTime, StatusMark, StepRuler } from "@/components/live";
import { cn } from "@/lib/utils";

/** Traços de prioridade: 1 a 3 (a forma, não a cor, carrega o sinal). */
const BAR_COUNT: Record<TaskPriority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
const PRIO_LABEL: Record<TaskPriority, string> = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta" };

/**
 * Dados extras do cartão que quem monta o quadro conhece e o Kanban não repassa (ele é congelado, RF26):
 * o estado vivo por tarefa e o nome do projeto. Chega por contexto, então o `KanbanBoard` não muda.
 */
export interface TaskCardExtras {
  live?: Record<string, LiveStatus>;
  /** Relógio único de quem monta a lista (useNow): os cartões não criam um timer cada. */
  now?: Date;
  engagementNameById?: Record<string, string>;
}
const TaskCardExtrasContext = createContext<TaskCardExtras>({});
export function TaskCardExtrasProvider({ value, children }: { value: TaskCardExtras; children: ReactNode }) {
  return <TaskCardExtrasContext.Provider value={value}>{children}</TaskCardExtrasContext.Provider>;
}
export function useTaskCardExtras(): TaskCardExtras {
  return useContext(TaskCardExtrasContext);
}

/** Texto curto que acompanha o rótulo do estado na linha viva. */
export function liveDetail(live: LiveStatus): string | null {
  switch (live.kind) {
    case "you":
    case "blocked":
    case "changes":
      return live.reason;
    case "review":
      return null;
    default:
      return live.doing ?? live.reason;
  }
}

/** Prioridade em 1–3 traços com rótulo acessível (a forma carrega o sinal, não a cor). */
export function PriorityMark({ priority }: { priority: TaskPriority }) {
  const bars = BAR_COUNT[priority];
  return (
    <span role="img" aria-label={`Prioridade ${PRIO_LABEL[priority].toLowerCase()}`} className="inline-flex h-3 items-end gap-[2px]">
      {[1, 2, 3].map((n) => (
        <i key={n} aria-hidden="true" data-bar={n <= bars ? "on" : "off"} className={cn("block h-3 w-[3px] not-italic", n <= bars ? "bg-foreground" : "bg-border")} />
      ))}
    </span>
  );
}

/** ids dos responsáveis (principal primeiro, depois extras), sem duplicar. */
export function assigneeIdsOf(task: Task): string[] {
  const ids = task.assigneeId ? [task.assigneeId] : [];
  for (const id of task.extraAssigneeIds ?? []) if (!ids.includes(id)) ids.push(id);
  return ids;
}

function Responsible({ ids, membersById }: { ids: string[]; membersById: Record<string, string> }) {
  if (ids.length === 0) {
    return (
      <span title="Sem responsável" className="flex size-[22px] items-center justify-center rounded-sm border border-dashed border-muted text-[13px] text-muted">
        <span aria-hidden="true">+</span>
        <span className="sr-only">Sem responsável</span>
      </span>
    );
  }
  const name = membersById[ids[0]];
  const extra = ids.length - 1;
  return (
    <span className="flex items-center gap-1">
      <span title={name ?? "Sem acesso ao cliente"} className="flex size-[22px] items-center justify-center rounded-sm border border-border bg-surface-tertiary text-[10px] font-semibold text-foreground">
        {name ? initials(name) : "?"}
      </span>
      {extra > 0 && <span className="mono text-[11px] text-muted">+{extra}</span>}
    </span>
  );
}

function LiveLine({ live, now, id }: { live: LiveStatus; now?: Date; id?: string }) {
  const detail = liveDetail(live);
  const alert = live.kind === "silent" || live.kind === "blocked";
  return (
    <div id={id} className="mt-2 flex items-center gap-1.5 text-[12px]" data-live-line={live.kind}>
      <StatusMark kind={live.kind} label={live.label} className="shrink-0" />
      {detail && <span className="min-w-0 truncate text-muted" title={detail}>· {detail}</span>}
      <SignalTime iso={live.lastSignalAt} now={now} alert={alert} className="ml-auto shrink-0 text-[11px]" />
    </div>
  );
}

/** "Agora" das tabelas (RF27): estado vivo com a frase; sem fluxo, o status da tarefa em texto discreto. */
export function NowCell({ live, fallback }: { live?: LiveStatus; fallback: string }) {
  if (!live || live.kind === "done") return <span className="text-muted">{fallback}</span>;
  const detail = liveDetail(live);
  return (
    <span className="flex min-w-0 flex-col gap-0.5" data-live-line={live.kind}>
      <StatusMark kind={live.kind} label={live.label} />
      {detail && <span className="line-clamp-2 break-words text-[12px] text-muted" title={detail}>{detail}</span>}
    </span>
  );
}

/** Passos das tabelas: régua + n/total; sem relato, travessão. */
export function StepsCell({ live }: { live?: LiveStatus }) {
  const steps = live && live.kind !== "done" ? live.steps : null;
  if (!steps || steps.total <= 0) return <span className="text-muted">—</span>;
  return <StepRuler done={steps.done} total={steps.total} kind={live!.kind} />;
}

/** Último sinal das tabelas: tempo relativo + hora (mono); em alerta quando sem sinal ou bloqueada. */
export function SignalCell({ live, now }: { live?: LiveStatus; now?: Date }) {
  if (!live || live.kind === "done") return <span className="mono text-muted">—</span>;
  return <SignalTime iso={live.lastSignalAt} now={now} alert={live.kind === "silent" || live.kind === "blocked"} className="text-[12px]" />;
}

/** Quem executa: o agente (canal MCP) ou o responsável; sem fluxo, o responsável da tarefa. */
export function whoLabel(task: Task, membersById: Record<string, string>, live?: LiveStatus): { name: string | null; extra: number } {
  const ids = assigneeIdsOf(task);
  const first = ids[0] ? membersById[ids[0]] ?? null : null;
  const extra = Math.max(0, ids.length - 1);
  if (live && live.kind !== "done" && live.channel === "MCP") return { name: live.who, extra: 0 };
  return { name: first ?? (live && live.kind !== "done" ? live.who : null), extra };
}

export function TaskCard({
  task,
  onOpen,
  membersById,
  clientName,
  projectName,
  asButton,
  dragHandleSpace = false,
  live,
}: {
  task: Task;
  onOpen?: () => void;
  membersById: Record<string, string>;
  clientName?: string; // cliente › projeto no topo — só na visão global que cruza clientes [tarefas-visao-global]
  projectName?: string; // segundo segmento do kicker; sem ele, o nome vem do contexto (por `engagementId`)
  dragHandleSpace?: boolean;
  asButton?: boolean; // torna o card acionável por teclado (Enter/Espaço) + foco visível [shell-mobile a11y]
  /** Estado vivo da execução. Sem ele, o contexto (`TaskCardExtrasProvider`) é consultado; sem fluxo, sem linha viva (RF25). */
  live?: LiveStatus;
}) {
  const extras = useTaskCardExtras();
  const uid = useId();
  const titleId = `${uid}-title`;
  const liveId = `${uid}-live`;
  const footId = `${uid}-foot`;
  const done = task.status === "DONE";
  const liveStatus = live ?? extras.live?.[task.id];
  const showLive = !!liveStatus && liveStatus.kind !== "done" && !done;
  const due = dueTag(task.dueDate, task.status);
  const overdue = due.state === "overdue";
  const subs = task.subtasks ?? [];
  const subDone = subs.filter((s) => s.done).length;
  const project = projectName ?? (task.engagementId ? extras.engagementNameById?.[task.engagementId] : undefined);
  const kicker = clientName ? (project ? `${clientName} › ${project}` : clientName) : undefined;
  const steps = showLive ? liveStatus.steps : null;

  const className = cn(
    "block w-full rounded-sm border border-border bg-card p-3 text-left shadow-none transition-[border-color] duration-150 hover:border-foreground",
    onOpen && "cursor-pointer",
    asButton && "outline-none focus-visible:ring-2 focus-visible:ring-ring",
  );
  const content = <>
      {kicker && (
        <div className={cn("mb-1 truncate text-[11.5px] text-muted", dragHandleSpace && "pr-8")} title={kicker}>
          {kicker}
        </div>
      )}
      <div id={titleId} className={cn("line-clamp-2 text-[13.5px] font-semibold leading-snug", dragHandleSpace && "pr-8", done && "font-normal text-muted line-through")}>
        {task.title}
      </div>
      {showLive && <LiveLine live={liveStatus} now={extras.now} id={liveId} />}
      <div id={footId} className="mt-2.5 flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5 text-[11.5px] text-muted">
          {steps && steps.total > 0 && <StepRuler done={steps.done} total={steps.total} kind={liveStatus?.kind} />}
          {due.label && (
            <span className={cn("mono shrink-0 whitespace-nowrap", overdue ? "font-medium text-warning" : due.state === "today" && "text-foreground")}>{due.label}</span>
          )}
          {subs.length > 0 && (
            <span className="mono shrink-0" aria-label={`${subDone} de ${subs.length} subtarefas`}>
              {subDone}/{subs.length}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!done && (
            <PriorityMark priority={task.priority} />
          )}
          <Responsible ids={assigneeIdsOf(task)} membersById={membersById} />
        </div>
      </div>
    </>;
  return asButton ? <Button variant="unstyled" aria-labelledby={titleId} aria-describedby={showLive ? `${liveId} ${footId}` : footId} onClick={onOpen} className={className}>{content}</Button> : <Card className={className}>{content}</Card>;
}
