"use client";

import { Fragment, useRef, useState, type KeyboardEvent } from "react";
import { SignalTime, StatusMark, StepRuler } from "@/components/live";
import { cn } from "@/lib/utils";
import { CHANNEL_LABEL, nowText, type AgoraRow, type RowGroup } from "./agora-model";
import { RowDetail } from "./row-detail";

const TH = "border-b border-border px-2.5 pb-1.5 pt-2 text-left text-[11px] font-semibold uppercase tracking-[.06em] text-muted";

/**
 * Mesa de operações (≥ 768 px). [RF11, RF13]
 * Tabela semântica própria: o `Table` do HeroUI (React Aria) é uma grade com foco por célula e a expansão dele é a de
 * árvore (linhas-filhas com as mesmas colunas), que não comporta um painel de detalhe com botões. Aqui cada linha é
 * focável, expande com Enter/Espaço/clique (`aria-expanded`), ↑/↓ andam entre linhas e O abre a folha.
 */
export function OperationsTable({ groups, now, openId, onToggle, onOpen }: {
  groups: RowGroup[]; now: Date; openId: string | null; onToggle: (taskId: string) => void; onOpen: (taskId: string) => void;
}) {
  const table = useRef<HTMLTableElement>(null);
  // Roving tabindex: uma única parada de Tab na tabela (a linha ativa); ↑/↓ movem. Se a linha ativa sumiu (filtro), vale a primeira.
  const [activeId, setActiveId] = useState<string | null>(null);
  const ids = groups.flatMap(group => group.rows.map(row => row.item.taskId));
  const tabStop = activeId && ids.includes(activeId) ? activeId : ids[0];

  function onKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    const row = (event.target as HTMLElement).closest<HTMLTableRowElement>("tr[data-row]");
    // Só teclas da própria linha: botões do painel expandido ficam fora de `tr[data-row]`.
    if (!row || event.target !== row || event.ctrlKey || event.metaKey || event.altKey) return;
    const taskId = row.dataset.taskId!;
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onToggle(taskId); return; }
    if (event.key.toLowerCase() === "o") { event.preventDefault(); onOpen(taskId); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const rows = [...(table.current?.querySelectorAll<HTMLTableRowElement>("tr[data-row]") ?? [])];
      rows[rows.indexOf(row) + (event.key === "ArrowDown" ? 1 : -1)]?.focus();
    }
  }

  return (
    <div className="overflow-x-auto">
      <table ref={table} aria-label="Execuções em andamento" onKeyDown={onKeyDown} className="w-full border-collapse">
        <thead>
          <tr>
            <th scope="col" className={cn(TH, "w-[120px]")}>Quem</th>
            <th scope="col" className={TH}>Tarefa</th>
            <th scope="col" className={TH}>Agora</th>
            <th scope="col" className={cn(TH, "w-[140px]")}>Passos</th>
            <th scope="col" className={cn(TH, "w-[110px] text-right")}>Último sinal</th>
          </tr>
        </thead>
        {groups.map(group => (
          <tbody key={group.key}>
            <tr>
              <th scope="rowgroup" colSpan={5} className="border-b border-foreground px-2.5 pb-1.5 pt-[18px] text-left text-[13px] font-bold">
                {group.label}<span className="mono ml-1.5 font-normal text-muted">{group.rows.length}</span>
              </th>
            </tr>
            {group.rows.map(row => <OperationRow key={row.item.taskId} row={row} now={now} open={openId === row.item.taskId} tabStop={tabStop === row.item.taskId} onFocusRow={setActiveId} onToggle={onToggle} onOpen={onOpen} />)}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function OperationRow({ row, now, open, tabStop, onFocusRow, onToggle, onOpen }: { row: AgoraRow; now: Date; open: boolean; tabStop: boolean; onFocusRow: (taskId: string) => void; onToggle: (taskId: string) => void; onOpen: (taskId: string) => void }) {
  const { item, live } = row;
  const panel = `agora-detail-${item.taskId}`;
  const rowId = `agora-row-${item.taskId}`;
  const alert = live.kind === "silent" || live.kind === "blocked";
  const cell = "border-b px-2.5 py-[11px] align-top";
  const edge = open ? "border-transparent bg-surface" : "border-border";
  return (
    <Fragment>
      <tr
        id={rowId} data-row="" data-task-id={item.taskId} data-kind={live.kind} tabIndex={tabStop ? 0 : -1} onFocus={event => { if (event.target === event.currentTarget) onFocusRow(item.taskId); }}
        aria-expanded={open} aria-controls={open ? panel : undefined}
        onClick={() => onToggle(item.taskId)}
        className="cursor-pointer outline-none hover:bg-surface-secondary/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <td className={cn(cell, edge, "whitespace-nowrap font-semibold")}>
          {live.who}
          {live.channel && <small className="mono block text-[11px] font-normal text-muted">{CHANNEL_LABEL[live.channel]}</small>}
        </td>
        <td className={cn(cell, edge, "font-semibold")}>
          <span className="break-words">{item.title}</span>
          <small className="block text-xs font-normal text-muted">{[item.clientName, item.projectName].filter(Boolean).join(" › ")}</small>
        </td>
        <td className={cn(cell, edge, "max-w-[340px]")}>
          <div className="mb-0.5 text-xs font-semibold"><StatusMark kind={live.kind} label={live.label} /></div>
          <span className="line-clamp-2 break-words">{nowText(live)}</span>
        </td>
        <td className={cn(cell, edge, "whitespace-nowrap")}>
          {live.steps && live.steps.total > 0 ? <StepRuler done={live.steps.done} total={live.steps.total} kind={live.kind} /> : <span className="text-xs text-muted">sem passos relatados</span>}
        </td>
        <td className={cn(cell, edge, "whitespace-nowrap text-right")}><SignalTime iso={live.lastSignalAt} now={now} alert={alert} stack /></td>
      </tr>
      {open && (
        <tr id={panel} aria-labelledby={rowId}>
          <td colSpan={5} className="bg-surface px-2.5 pb-[18px] pt-0"><RowDetail row={row} onOpen={onOpen} /></td>
        </tr>
      )}
    </Fragment>
  );
}
