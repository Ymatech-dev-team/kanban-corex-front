"use client";

import { User } from "lucide-react";
import type { Task } from "@/lib/types";
import type { TaskPriority, TaskStatus } from "@sistema-tasks/contracts";
import { initials } from "@/lib/initials";
import { dueState } from "@/lib/due";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<TaskStatus, string> = { TODO: "A fazer", DOING: "Fazendo", DONE: "Feito" };
const PRIO_LABEL: Record<TaskPriority, string> = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta" };

function StatusDot({ status }: { status: TaskStatus }) {
  if (status === "TODO") return <span className="size-[8px] rounded-full border-[1.5px] border-muted-foreground" />;
  if (status === "DONE") return <span className="size-[8px] rounded-full bg-muted-foreground/70" />;
  return (
    <span
      className="size-[8px] rounded-full border-[1.5px] border-foreground"
      style={{ background: "conic-gradient(var(--foreground) 0 50%, transparent 50% 100%)" }}
    />
  );
}

export interface EngagementLite {
  name: string;
  isGeneral: boolean;
}

/**
 * Tabela da visão global: reusa o layout da lista do board somando a coluna "Cliente · Projeto".
 * Ordem preservada do backend (dueDate asc, determinística). Coluna de contexto some quando 1 cliente+1 projeto fixos.
 */
export function GlobalTaskTable({
  tasks,
  membersById,
  clientsById,
  engagementsById,
  showContext,
  onOpenTask,
}: {
  tasks: Task[];
  membersById: Record<string, string>;
  clientsById: Record<string, string>;
  engagementsById: Record<string, EngagementLite>;
  showContext: boolean;
  onOpenTask: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[720px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground/70">
            <th className="px-4 py-2.5 font-medium">Tarefa</th>
            {showContext && <th className="px-4 py-2.5 font-medium">Cliente</th>}
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Prioridade</th>
            <th className="px-4 py-2.5 font-medium">Prazo</th>
            <th className="px-4 py-2.5 font-medium">Responsável</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const done = t.status === "DONE";
            const due = dueState(t.dueDate, t.status);
            const attention = due.state === "soon" || due.state === "overdue";
            const ids = t.assigneeId
              ? [t.assigneeId, ...(t.extraAssigneeIds ?? []).filter((id) => id !== t.assigneeId)]
              : (t.extraAssigneeIds ?? []);
            const firstName = ids[0] ? (membersById[ids[0]] ?? null) : null;
            const moreCount = Math.max(0, ids.length - 1);
            const subs = t.subtasks ?? [];
            const eng = t.engagementId ? engagementsById[t.engagementId] : undefined;
            return (
              <tr
                key={t.id}
                onClick={() => onOpenTask(t.id)}
                className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-card"
              >
                <td className="px-4 py-2.5">
                  <span className={cn(done && "text-muted-foreground line-through")}>{t.title}</span>
                  {subs.length > 0 && (
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      {subs.filter((s) => s.done).length}/{subs.length}
                    </span>
                  )}
                </td>
                {showContext && (
                  <td className="px-4 py-2.5">
                    <span className="block max-w-[200px] truncate" title={clientsById[t.projectId] ?? undefined}>
                      {clientsById[t.projectId] ?? "Cliente"}
                    </span>
                    {eng && !eng.isGeneral && (
                      <span className="block max-w-[200px] truncate text-[11px] text-muted-foreground" title={eng.name}>
                        {eng.name}
                      </span>
                    )}
                  </td>
                )}
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <StatusDot status={t.status} />
                    {STATUS_LABEL[t.status]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{PRIO_LABEL[t.priority]}</td>
                <td className={cn("px-4 py-2.5", attention ? "text-amber" : "text-muted-foreground")}>
                  {due.label || "—"}
                </td>
                <td className="px-4 py-2.5">
                  {ids.length === 0 ? (
                    <span className="text-muted-foreground/50">—</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 bg-accent text-[10px] font-medium text-foreground">
                        {firstName ? initials(firstName) : <User className="size-3 text-muted-foreground" />}
                      </span>
                      {firstName && <span className="text-muted-foreground">{firstName}</span>}
                      {moreCount > 0 && <span className="text-[11px] text-muted-foreground/70">+{moreCount}</span>}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
