"use client";
import { Table, Checkbox } from "@heroui/react";

import { useRef } from "react";
import type { Task } from "@/lib/types";
import type { TaskStatus } from "@sistema-tasks/contracts";
import { initials } from "@/lib/initials";
import { dueTag } from "@/lib/due";
import { STATUS_LABEL } from "@/lib/board-filters";
import { NowCell, PriorityMark, SignalCell, StepsCell, TaskCard, useTaskCardExtras, whoLabel } from "@/components/board/task-card";
import { cn } from "@/lib/utils";
const STATUS_ORDER: Record<TaskStatus, number> = { TODO: 0, DOING: 1, DONE: 2 };

const head = "border-b border-border bg-transparent px-2.5 pb-1.5 pt-2 text-left text-[11px] font-semibold uppercase tracking-[.06em] text-muted";

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
  const { live, now } = useTaskCardExtras();
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
    <div onPointerDownCapture={(event) => { shiftPressed.current = event.shiftKey; }} onKeyDownCapture={(event) => { shiftPressed.current = event.shiftKey; }} className={cn("flex-1 overflow-auto px-4 pb-10 pt-1 lg:px-6", selectMode && "pb-28")}>
      {/* Mobile: cards (um por tarefa, mesma ordem da tabela). Reusa o TaskCard. [shell-mobile] */}
      <ul className="grid gap-2.5 md:grid-cols-2 xl:hidden">
        {rows.map((t, idx) => {
          const sel = isSelected?.(t.id);
          if (selectMode) {
            return (
              <li key={t.id}>
                <Checkbox slot={null} isSelected={!!sel} onChange={() => activateRow(idx, t.id, shiftPressed.current)} aria-label={`Selecionar tarefa: ${t.title}`} className={cn("relative block w-full", sel && "rounded-sm ring-2 ring-primary")}><Checkbox.Content className="block w-full">
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

      {/* ≥ 1280 px: tabela plana (RF27: mesmas colunas da Agora, mais prazo e prioridade). Abaixo disso, cartões. */}
      <div className="hidden xl:block">
        <Table className="rounded-none border-0 bg-transparent shadow-none"><Table.ScrollContainer><Table.Content aria-label="Tarefas" className="w-full border-collapse text-[13px]">
          <Table.Header>
              {selectMode && (
                <Table.Column className={cn(head, "w-10")}>
                  <Checkbox slot={null} isSelected={!!allSelected} onChange={() => onToggleAll?.()} aria-label={allSelected ? "Desmarcar todas" : "Selecionar todas"}><Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control></Checkbox.Content></Checkbox>
                </Table.Column>
              )}
              <Table.Column className={cn(head, "w-[110px]")}>Quem</Table.Column>
              <Table.Column isRowHeader className={head}>Tarefa</Table.Column>
              <Table.Column className={cn(head, "w-[190px]")}>Agora</Table.Column>
              <Table.Column className={cn(head, "w-[130px]")}>Passos</Table.Column>
              <Table.Column className={cn(head, "w-[110px]")}>Último sinal</Table.Column>
              <Table.Column className={cn(head, "w-[96px]")}>Prazo</Table.Column>
              <Table.Column className={cn(head, "w-[76px]")}>Prioridade</Table.Column>
            </Table.Header>
          <Table.Body>
            {rows.map((t, idx) => {
              const done = t.status === "DONE";
              const sel = isSelected?.(t.id);
              const lv = live?.[t.id];
              const due = dueTag(t.dueDate, t.status);
              const who = whoLabel(t, membersById, lv);
              const subs = t.subtasks ?? [];
              return (
                <Table.Row
                  id={t.id}
                  key={t.id}
                  onAction={() => activateRow(idx, t.id, shiftPressed.current)}
                  className={cn(
                    "cursor-pointer align-top outline-none transition-colors hover:bg-surface-secondary/60",
                    sel && "bg-primary/10",
                  )}
                >
                  {selectMode && (
                    <Table.Cell className="px-2.5 py-[11px] border-b border-border">
                      <Checkbox slot={null} isSelected={!!sel} onChange={() => activateRow(idx, t.id, shiftPressed.current)} aria-label={`Selecionar tarefa: ${t.title}`}><Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control></Checkbox.Content></Checkbox>
                    </Table.Cell>
                  )}
                  <Table.Cell className="px-2.5 py-[11px] border-b border-border">
                    {who.name ? (
                      <span className="flex items-center gap-2">
                        <span aria-hidden="true" className="flex size-[22px] shrink-0 items-center justify-center rounded-sm border border-border bg-surface-tertiary text-[10px] font-semibold text-foreground">{initials(who.name)}</span>
                        <span className="truncate" title={who.name}>{who.name}</span>
                        {who.extra > 0 && <span className="mono text-[11px] text-muted">+{who.extra}</span>}
                      </span>
                    ) : (
                      <span className="text-muted">{t.assigneeId || (t.extraAssigneeIds ?? []).length ? "Sem acesso" : "—"}</span>
                    )}
                  </Table.Cell>
                  <Table.Cell className="px-2.5 py-[11px] border-b border-border">
                    <span className={cn("line-clamp-2 font-semibold", done && "font-normal text-muted line-through")}>{t.title}</span>
                    {subs.length > 0 && (
                      <span className="mono mt-0.5 block text-[11px] text-muted">{subs.filter((s) => s.done).length}/{subs.length} subtarefas</span>
                    )}
                  </Table.Cell>
                  <Table.Cell className="px-2.5 py-[11px] border-b border-border"><NowCell live={lv} fallback={STATUS_LABEL[t.status]} /></Table.Cell>
                  <Table.Cell className="px-2.5 py-[11px] border-b border-border"><StepsCell live={lv} /></Table.Cell>
                  <Table.Cell className="px-2.5 py-[11px] border-b border-border"><SignalCell live={lv} now={now} /></Table.Cell>
                  <Table.Cell className={cn("mono px-2.5 py-[11px] border-b border-border", due.state === "overdue" ? "font-medium text-warning" : due.state === "today" ? "text-foreground" : "text-muted")}>
                    {due.label || "—"}
                  </Table.Cell>
                  <Table.Cell className="px-2.5 py-[11px] border-b border-border">{done ? <span className="text-muted">—</span> : <PriorityMark priority={t.priority} />}</Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Content></Table.ScrollContainer></Table>
      </div>
    </div>
  );
}
