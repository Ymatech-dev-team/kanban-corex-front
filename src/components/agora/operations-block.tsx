"use client";

import { useState } from "react";
import Link from "next/link";
import { Kbd, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { SectionHeader } from "@/components/live";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatClock } from "@/lib/format-since";
import { TEAM_FEED_LIMIT } from "@/lib/hooks/use-workflow";
import { BlockError } from "./block-error";
import { filterRows, groupRows, type AgoraRow, type GroupBy, type ViewFilter } from "./agora-model";
import { OperationsList } from "./operations-list";
import { OperationsTable } from "./operations-table";
import { useOpenSheet } from "./open-sheet";
import { useIsNarrow } from "./use-narrow";

const GROUP_LABEL: Record<GroupBy, string> = { estado: "Por estado", pessoa: "Por pessoa", cliente: "Por cliente" };

function OperationsSkeleton({ narrow }: { narrow: boolean }) {
  return (
    <div role="status" aria-label="Carregando execuções em andamento" className="space-y-1 py-2">
      {Array.from({ length: 4 }, (_, index) => narrow
        ? <div key={index} className="space-y-1.5 border-b border-border py-3"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-3 w-1/2" /></div>
        : <div key={index} className="grid grid-cols-[120px_1.2fr_1.4fr_140px_110px] items-start gap-4 border-b border-border px-2.5 py-3"><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-24" /><Skeleton className="ml-auto h-4 w-14" /></div>)}
    </div>
  );
}

/** Em andamento (RF11–RF13, RF16–RF18): cabeçalho com "agrupar por", tabela/lista, estados de carga, erro e vazio. */
export function OperationsBlock({ rows, now, group, onGroup, canGroupByPerson, view, onClearView, loading, error, denied, retrying, onRetry, truncated, updatedAt, createHref }: {
  rows: AgoraRow[]; now: Date; group: GroupBy; onGroup: (group: GroupBy) => void; canGroupByPerson: boolean;
  view: ViewFilter | null; onClearView: () => void;
  loading: boolean; error: boolean; /** Erro 401/403/404: sem dado antigo. */ denied: boolean; retrying: boolean; onRetry: () => void; truncated: boolean; updatedAt: number; createHref: string;
}) {
  const narrow = useIsNarrow();
  const open = useOpenSheet();
  const [openId, setOpenId] = useState<string | null>(null);
  const shown = filterRows(rows, view);
  const groups = groupRows(shown, group);
  const keys = (canGroupByPerson ? ["estado", "pessoa", "cliente"] : ["estado", "cliente"]) as GroupBy[];

  const toggle = (
    <ToggleButtonGroup aria-label="Agrupar por" size="sm" selectionMode="single" disallowEmptySelection selectedKeys={new Set([group])}
      onSelectionChange={selection => { const next = [...selection][0] as GroupBy | undefined; if (next) onGroup(next); }}>
      {keys.map((key, index) => (
        <ToggleButton key={key} id={key} className="max-md:min-h-11">
          {index > 0 && <ToggleButtonGroup.Separator />}
          {GROUP_LABEL[key]}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
  const hasStale = error && rows.length > 0;

  return (
    <section aria-labelledby="h-ops" className="mt-9">
      <SectionHeader title="Em andamento" id="h-ops" count={loading ? undefined : shown.length} right={narrow ? undefined : toggle} />
      {narrow && !loading && rows.length > 0 && <div className="mb-1 flex">{toggle}</div>}
      {loading ? <OperationsSkeleton narrow={narrow} />
        : error && (denied || rows.length === 0) ? <BlockError message="Não foi possível consultar as execuções em andamento." onRetry={onRetry} retrying={retrying} />
        : <>
          {hasStale && <BlockError message="Não foi possível atualizar. Mostrando o último estado carregado." onRetry={onRetry} retrying={retrying} />}
          {rows.length === 0 ? (
            <div className="py-8">
              <p className="m-0 font-semibold">Nada em andamento agora.</p>
              <p className="mb-3 mt-1 max-w-prose text-muted">Crie uma tarefa ou conecte um agente para ver o trabalho acontecendo aqui.</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm" className="max-md:h-11"><Link href={createHref}>Criar tarefa</Link></Button>
                <Button asChild variant="outline" size="sm" className="max-md:h-11"><Link href="/conta#mcp-connections-title">Conectar um agente · Conta › conexões MCP</Link></Button>
              </div>
            </div>
          ) : shown.length === 0 ? (
            <div className="flex flex-wrap items-center gap-3 py-6">
              <p className="m-0 text-muted">Nada nesse filtro agora.</p>
              <Button type="button" variant="outline" size="sm" className="max-md:h-11" onClick={onClearView}>Limpar filtro</Button>
            </div>
          ) : narrow
            ? <OperationsList groups={groups} now={now} />
            : <OperationsTable groups={groups} now={now} openId={openId} onToggle={id => setOpenId(current => current === id ? null : id)} onOpen={open} />}
          <p className="mb-0 mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
            {!narrow && rows.length > 0 && <>
              <Kbd><Kbd.Abbr keyValue="up" /></Kbd><Kbd><Kbd.Abbr keyValue="down" /></Kbd> navega
              <span aria-hidden="true">·</span><Kbd><Kbd.Abbr keyValue="enter" /></Kbd> expande
              <span aria-hidden="true">·</span><Kbd><Kbd.Content>O</Kbd.Content></Kbd> abre a folha
              <span aria-hidden="true">·</span>
            </>}
            {updatedAt > 0 && <span className="mono">atualizado {formatClock(new Date(updatedAt).toISOString())}</span>}
            {truncated && <><span aria-hidden="true">·</span><span>mostrando os {TEAM_FEED_LIMIT} mais recentes</span></>}
          </p>
        </>}
    </section>
  );
}
