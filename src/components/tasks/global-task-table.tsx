"use client";
import { Table } from "@heroui/react";

import type { Task } from "@/lib/types";
import { dueTag } from "@/lib/due";
import { STATUS_LABEL } from "@/lib/board-filters";
import { initials } from "@/lib/initials";
import { NowCell, PriorityMark, SignalCell, StepsCell, TaskCard, useTaskCardExtras, whoLabel } from "@/components/board/task-card";
import { cn } from "@/lib/utils";

export interface EngagementLite {
  name: string;
  isGeneral: boolean;
}

const head = "border-b border-border bg-transparent px-2.5 pb-1.5 pt-2 text-left text-[11px] font-semibold uppercase tracking-[.06em] text-muted";

/**
 * Tabela da visão global (RF27, ≥ 1280 px): Quem, Tarefa (cliente › projeto), Agora, Passos, Último sinal, Prazo e Prioridade.
 * Ordem preservada do backend (dueDate asc, determinística). O estado vivo chega pelo contexto do cartão.
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
  const { live, now } = useTaskCardExtras();
  return (
    <>
    {/* Mobile: um cartão por tarefa (mesmo TaskCard do quadro). [shell-mobile] */}
    <ul className="grid gap-2.5 md:grid-cols-2 xl:hidden">
      {tasks.map((t) => {
        const eng = t.engagementId ? engagementsById[t.engagementId] : undefined;
        const projectName = eng && !eng.isGeneral ? eng.name : undefined;
        return (
          <li key={t.id}>
            <TaskCard
              task={t}
              onOpen={() => onOpenTask(t.id)}
              membersById={membersById}
              clientName={showContext ? (clientsById[t.projectId] ?? "Cliente") : undefined}
              projectName={showContext ? projectName : undefined}
              asButton
            />
          </li>
        );
      })}
    </ul>

    {/* ≥ 1280 px: tabela plana, alinhada à esquerda como a Agora. Abaixo disso as colunas não cabem sem rolar: valem os cartões. */}
    <div className="hidden xl:block">
      <Table className="rounded-none border-0 bg-transparent shadow-none"><Table.ScrollContainer><Table.Content aria-label="Tarefas" className="w-full border-collapse text-[13px]">
        <Table.Header>
            <Table.Column className={cn(head, "w-[110px]")}>Quem</Table.Column>
            <Table.Column isRowHeader className={head}>Tarefa</Table.Column>
            <Table.Column className={cn(head, "w-[190px]")}>Agora</Table.Column>
            <Table.Column className={cn(head, "w-[130px]")}>Passos</Table.Column>
            <Table.Column className={cn(head, "w-[110px]")}>Último sinal</Table.Column>
            <Table.Column className={cn(head, "w-[96px]")}>Prazo</Table.Column>
            <Table.Column className={cn(head, "w-[76px]")}>Prioridade</Table.Column>
          </Table.Header>
        <Table.Body>
          {tasks.map((t) => {
            const done = t.status === "DONE";
            const lv = live?.[t.id];
            const due = dueTag(t.dueDate, t.status);
            const who = whoLabel(t, membersById, lv);
            const subs = t.subtasks ?? [];
            const eng = t.engagementId ? engagementsById[t.engagementId] : undefined;
            const client = showContext ? (clientsById[t.projectId] ?? "Cliente") : null;
            const context = client ? (eng && !eng.isGeneral ? `${client} › ${eng.name}` : client) : null;
            return (
              <Table.Row
                id={t.id}
                key={t.id}
                onAction={() => onOpenTask(t.id)}
                className="cursor-pointer align-top outline-none transition-colors hover:bg-surface-secondary/60"
              >
                <Table.Cell className="px-2.5 py-[11px] border-b border-border">
                  {who.name ? (
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className="flex size-[22px] shrink-0 items-center justify-center rounded-sm border border-border bg-surface-tertiary text-[10px] font-semibold text-foreground">{initials(who.name)}</span>
                      <span className="truncate" title={who.name}>{who.name}</span>
                      {who.extra > 0 && <span className="mono text-[11px] text-muted">+{who.extra}</span>}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </Table.Cell>
                <Table.Cell className="px-2.5 py-[11px] border-b border-border">
                  <span className={cn("line-clamp-2 font-semibold", done && "font-normal text-muted line-through")}>{t.title}</span>
                  {context && <span className="mt-0.5 block max-w-[420px] truncate text-[12px] text-muted" title={context}>{context}</span>}
                  {subs.length > 0 && (
                    <span className="mono mt-0.5 block text-[11px] text-muted">{subs.filter((s) => s.done).length}/{subs.length} subtarefas</span>
                  )}
                </Table.Cell>
                <Table.Cell className="px-2.5 py-[11px] border-b border-border">
                  <NowCell live={lv} fallback={STATUS_LABEL[t.status]} />
                </Table.Cell>
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
    </>
  );
}
