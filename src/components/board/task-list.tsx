"use client";
import { Table, Checkbox } from "@heroui/react";

import { useRef } from "react";
import { User } from "lucide-react";
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
  if (status === "DONE") return <span className="size-[8px] rounded-full bg-surface-secondary-foreground/70" />;
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
  const shiftPressed = useRef(false);
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
    <div onPointerDownCapture={(event) => { shiftPressed.current = event.shiftKey; }} onKeyDownCapture={(event) => { shiftPressed.current = event.shiftKey; }} className={cn("flex-1 overflow-auto p-6", selectMode && "pb-28")}>
      {/* Mobile: cards (um por tarefa, mesma ordem da tabela). Reusa o TaskCard. [shell-mobile] */}
      <ul className="flex flex-col gap-2.5 lg:hidden">
        {rows.map((t, idx) => {
          const sel = isSelected?.(t.id);
          if (selectMode) {
            return (
              <li key={t.id}>
                <Checkbox slot={null} isSelected={!!sel} onChange={() => activateRow(idx, t.id, shiftPressed.current)} aria-label={`Selecionar tarefa: ${t.title}`} className={cn("relative block w-full", sel && "rounded-xl ring-2 ring-primary")}><Checkbox.Content className="block w-full">
                  <TaskCard task={t} membersById={membersById} />
                  <Checkbox.Control className="absolute right-2 top-2"><Checkbox.Indicator /></Checkbox.Control>
                </Checkbox.Content></Checkbox>
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
        <Table><Table.ScrollContainer><Table.Content aria-label="Tarefas" className="w-full min-w-[640px] border-collapse text-[13px]">
          <Table.Header>
              {selectMode && (
                <Table.Column className="w-10 px-4 py-2.5 font-medium">
                  <Checkbox slot={null} isSelected={!!allSelected} onChange={() => onToggleAll?.()} aria-label={allSelected ? "Desmarcar todas" : "Selecionar todas"}><Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control></Checkbox.Content></Checkbox>
                </Table.Column>
              )}
              <Table.Column isRowHeader className="px-4 py-2.5 font-medium">Tarefa</Table.Column>
              <Table.Column className="px-4 py-2.5 font-medium">Status</Table.Column>
              <Table.Column className="px-4 py-2.5 font-medium">Prioridade</Table.Column>
              <Table.Column className="px-4 py-2.5 font-medium">Prazo</Table.Column>
              <Table.Column className="px-4 py-2.5 font-medium">Responsável</Table.Column>
            </Table.Header>
          <Table.Body>
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
                <Table.Row
                  id={t.id}
                  key={t.id}
                  onAction={() => activateRow(idx, t.id, shiftPressed.current)}
                  className={cn(
                    "cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-card",
                    sel && "bg-primary/10",
                  )}
                >
                  {selectMode && (
                    <Table.Cell className="px-4 py-2.5">
                      <Checkbox slot={null} isSelected={!!sel} onChange={() => activateRow(idx, t.id, shiftPressed.current)} aria-label={`Selecionar tarefa: ${t.title}`}><Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control></Checkbox.Content></Checkbox>
                    </Table.Cell>
                  )}
                  <Table.Cell className="px-4 py-2.5">
                    <span className={cn(done && "text-muted-foreground line-through")}>{t.title}</span>
                    {subs.length > 0 && (
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        {subs.filter((s) => s.done).length}/{subs.length}
                      </span>
                    )}
                  </Table.Cell>
                  <Table.Cell className="px-4 py-2.5">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <StatusDot status={t.status} />
                      {STATUS_LABEL[t.status]}
                    </span>
                  </Table.Cell>
                  <Table.Cell className="px-4 py-2.5 text-muted-foreground">{PRIO_LABEL[t.priority]}</Table.Cell>
                  <Table.Cell className={cn("px-4 py-2.5", attention ? "text-amber" : "text-muted-foreground")}>
                    {due.label || "—"}
                  </Table.Cell>
                  <Table.Cell className="px-4 py-2.5">
                    {ids.length === 0 ? (
                      <span className="text-muted-foreground/50">—</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 bg-surface-tertiary text-[10px] font-medium text-foreground">
                          {firstName ? initials(firstName) : <User className="size-3 text-muted-foreground" />}
                        </span>
                        <span className="text-muted-foreground">{firstName ?? "Sem acesso"}</span>
                        {moreCount > 0 && <span className="text-[11px] text-muted-foreground/70">+{moreCount}</span>}
                      </span>
                    )}
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Content></Table.ScrollContainer></Table>
      </div>
    </div>
  );
}
