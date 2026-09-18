"use client";

import { useRef } from "react";
import { Check, User } from "lucide-react";
import type { Task } from "@/lib/types";
import type { TaskPriority, TaskStatus } from "@sistema-tasks/contracts";
import { initials } from "@/lib/initials";
import { dueState } from "@/lib/due";
import { STATUS_LABEL } from "@/lib/board-filters";
import { TaskCard } from "@/components/board/task-card";
import { cn } from "@/lib/utils";
const STATUS_ORDER: Record<TaskStatus, number> = { TODO: 0, DOING: 1, DONE: 2 };
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

export function TaskList({
  tasks,
  membersById,
  onOpenTask,
  selectMode,
  isSelected,
  onToggleSelect,
  onSelectRange,
  allSelected,
  onToggleAll,
}: {
  tasks: Task[];
  membersById: Record<string, string>;
  onOpenTask: (id: string) => void;
  // Seleção múltipla (ações em massa). Ausentes = lista normal. [acoes-em-massa]
  selectMode?: boolean;
  isSelected?: (id: string) => boolean;
  onToggleSelect?: (id: string) => void;
  onSelectRange?: (ids: string[]) => void; // Shift+clique: intervalo contíguo
  allSelected?: boolean; // checkbox-mestre: todas as visíveis marcadas [RF-9]
  onToggleAll?: () => void;
}) {
  const rows = [...tasks].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.position - b.position,
  );

  // Âncora do Shift+clique (índice da última linha clicada). [RF-5]
  const lastIndexRef = useRef<number | null>(null);
  const activateRow = (idx: number, id: string, shiftKey: boolean) => {
    if (!selectMode) {
      onOpenTask(id);
      return;
    }
    if (shiftKey && lastIndexRef.current !== null) {
      const [a, b] = [lastIndexRef.current, idx].sort((x, y) => x - y);
      onSelectRange?.(rows.slice(a, b + 1).map((r) => r.id));
    } else {
      onToggleSelect?.(id);
    }
    lastIndexRef.current = idx;
  };

  return (
    <div className={cn("flex-1 overflow-auto p-6", selectMode && "pb-28")}>
      {/* Mobile: cards (um por tarefa, mesma ordem da tabela). Reusa o TaskCard. [shell-mobile] */}
      <ul className="flex flex-col gap-2.5 lg:hidden">
        {rows.map((t, idx) => {
          const sel = isSelected?.(t.id);
          if (selectMode) {
            return (
              <li key={t.id}>
                <div
                  role="checkbox"
                  tabIndex={0}
                  aria-checked={sel}
                  aria-label={`Selecionar tarefa: ${t.title}`}
                  onClick={(e) => activateRow(idx, t.id, e.shiftKey)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      activateRow(idx, t.id, e.shiftKey);
                    }
                  }}
                  className={cn(
                    "relative cursor-pointer select-none rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-ring",
                    sel && "ring-2 ring-primary",
                  )}
                >
                  <TaskCard task={t} membersById={membersById} />
                  <span
                    aria-hidden
                    className={cn(
                      "absolute right-2 top-2 flex size-5 items-center justify-center rounded-md border transition-colors",
                      sel ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50 bg-card/90",
                    )}
                  >
                    {sel && <Check className="size-3.5" />}
                  </span>
                </div>
              </li>
            );
          }
          return (
            <li key={t.id}>
              <TaskCard task={t} onOpen={() => onOpenTask(t.id)} membersById={membersById} asButton />
            </li>
          );
        })}
      </ul>

      {/* Desktop: tabela */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card lg:block">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground/70">
              {selectMode && (
                <th className="w-10 px-4 py-2.5 font-medium">
                  <span
                    role="checkbox"
                    aria-checked={allSelected}
                    aria-label={allSelected ? "Desmarcar todas" : "Selecionar todas"}
                    tabIndex={0}
                    onClick={() => onToggleAll?.()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggleAll?.();
                      }
                    }}
                    className={cn(
                      "flex size-5 cursor-pointer items-center justify-center rounded-md border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      allSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50 bg-card",
                    )}
                  >
                    {allSelected && <Check className="size-3.5" />}
                  </span>
                </th>
              )}
              <th className="px-4 py-2.5 font-medium">Tarefa</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Prioridade</th>
              <th className="px-4 py-2.5 font-medium">Prazo</th>
              <th className="px-4 py-2.5 font-medium">Responsável</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, idx) => {
              const done = t.status === "DONE";
              const sel = isSelected?.(t.id);
              const due = dueState(t.dueDate, t.status);
              const attention = due.state === "soon" || due.state === "overdue";
              // união (principal primeiro, depois extras) — coerente com o card [review R1]
              const ids = t.assigneeId
                ? [t.assigneeId, ...(t.extraAssigneeIds ?? []).filter((id) => id !== t.assigneeId)]
                : (t.extraAssigneeIds ?? []);
              const firstName = ids[0] ? membersById[ids[0]] ?? null : null;
              const moreCount = Math.max(0, ids.length - 1);
              const subs = t.subtasks ?? [];
              return (
                <tr
                  key={t.id}
                  onClick={(e) => activateRow(idx, t.id, e.shiftKey)}
                  className={cn(
                    "cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-card",
                    sel && "bg-primary/10",
                  )}
                >
                  {selectMode && (
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <span
                        role="checkbox"
                        aria-checked={sel}
                        aria-label={`Selecionar tarefa: ${t.title}`}
                        tabIndex={0}
                        onClick={(e) => activateRow(idx, t.id, e.shiftKey)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            activateRow(idx, t.id, e.shiftKey);
                          }
                        }}
                        className={cn(
                          "flex size-5 cursor-pointer items-center justify-center rounded-md border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                          sel ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50 bg-card",
                        )}
                      >
                        {sel && <Check className="size-3.5" />}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-2.5">
                    <span className={cn(done && "text-muted-foreground line-through")}>{t.title}</span>
                    {subs.length > 0 && (
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        {subs.filter((s) => s.done).length}/{subs.length}
                      </span>
                    )}
                  </td>
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
                        <span className="text-muted-foreground">{firstName ?? "Sem acesso"}</span>
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
    </div>
  );
}
