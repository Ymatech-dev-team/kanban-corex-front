"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ListTodo, SearchX } from "lucide-react";
import { useProjects } from "@/lib/hooks/use-projects";
import { useEngagements } from "@/lib/hooks/use-engagements";
import { useProjectMembers, useAccessibleMembers } from "@/lib/hooks/use-members";
import { useTaskDetail } from "@/lib/hooks/use-tasks";
import { useAllTasks } from "@/lib/hooks/use-all-tasks";
import {
  parseFilters,
  filtersToSearchParams,
  filtersToQuery,
  hasAnyFilter,
  DEFAULT_FILTERS,
  type GlobalFilters,
} from "@/lib/global-filters";
import { BoardSkeleton, BoardError, EmptyClients } from "@/components/board/board-states";
import { GlobalFilterBar } from "./global-filter-bar";
import { GlobalTaskTable, type EngagementLite } from "./global-task-table";
import { TaskDetailDialog } from "@/components/board/task-detail-dialog";
import { Button } from "@/components/ui/button";

export function GlobalTasksView() {
  const router = useRouter();
  const sp = useSearchParams();
  const filters = useMemo(() => parseFilters(new URLSearchParams(sp.toString())), [sp]);
  const taskParam = sp.get("task");

  const projects = useProjects();
  const clients = projects.data ?? [];
  // Projeto depende do cliente selecionado. Responsável é GLOBAL (pessoas dos clientes acessíveis). [RF-C6/C7]
  const engagements = useEngagements(filters.cliente ?? null);
  const accessibleMembers = useAccessibleMembers();

  const query = useMemo(() => filtersToQuery(filters), [filters]);
  const all = useAllTasks(query);

  // Detalhe in-place: resolve o cliente da tarefa aberta p/ passar os membros DELE ao dialog. [RF-E7]
  const openedDetail = useTaskDetail(taskParam);
  const openedMembers = useProjectMembers(openedDetail.data?.projectId ?? null);

  // Navega mantendo/limpando params. filtro → replace (não polui histórico); abrir tarefa → push. [RF-C1/E1]
  function navigate(next: GlobalFilters, opts?: { task?: string | null; push?: boolean }) {
    const params = filtersToSearchParams(next);
    const task = opts?.task === undefined ? taskParam : opts.task;
    if (task) params.set("task", task);
    const qs = params.toString();
    const url = qs ? `/tarefas?${qs}` : "/tarefas";
    if (opts?.push) router.push(url);
    else router.replace(url);
  }

  // Saneia id morto: cliente inválido dropa cliente+projeto; projeto sem cliente some; resp inexistente some. [RF-C5/C6]
  useEffect(() => {
    if (!projects.isSuccess) return;
    let next = filters;
    const clienteOk = !next.cliente || clients.some((c) => c.id === next.cliente);
    if (!clienteOk) next = { ...next, cliente: undefined, projeto: undefined };
    if (!next.cliente && next.projeto) next = { ...next, projeto: undefined };
    if (next.cliente && engagements.isSuccess && next.projeto && !(engagements.data ?? []).some((e) => e.id === next.projeto))
      next = { ...next, projeto: undefined };
    if (accessibleMembers.isSuccess && next.resp && !(accessibleMembers.data ?? []).some((m) => m.id === next.resp))
      next = { ...next, resp: undefined };
    if (filtersToSearchParams(next).toString() !== filtersToSearchParams(filters).toString()) {
      navigate(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.isSuccess, engagements.isSuccess, accessibleMembers.isSuccess, sp]);

  const clientsById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c.name])), [clients]);
  const engagementsById = useMemo<Record<string, EngagementLite>>(
    () => Object.fromEntries((engagements.data ?? []).map((e) => [e.id, { name: e.name, isGeneral: e.isGeneral }])),
    [engagements.data],
  );
  const membersById = useMemo(
    () => Object.fromEntries((accessibleMembers.data ?? []).map((m) => [m.id, m.name])),
    [accessibleMembers.data],
  );

  const tasks = all.data?.tasks ?? [];
  const count = tasks.length;
  // Label neutro no load (evita "0 tarefas" e o aria-live anunciando duas vezes). [review UX]
  const countLabel = all.isLoading
    ? ""
    : all.data?.hasMore
      ? `${count}+ tarefas`
      : `${count} ${count === 1 ? "tarefa" : "tarefas"}`;
  const showOpenBoard = !!filters.cliente && !!filters.projeto;
  const showContext = !(filters.cliente && filters.projeto);

  // ----- estados de topo (antes da barra) -----
  if (projects.isLoading) return <BoardSkeleton />;
  if (projects.isError) return <BoardError onRetry={() => projects.refetch()} />;
  if (clients.length === 0) return <EmptyClients onCreate={() => router.push("/clientes")} />;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <GlobalFilterBar
        filters={filters}
        onChange={(f) => navigate(f)}
        clients={clients}
        engagements={engagements.data ?? []}
        members={accessibleMembers.data ?? []}
        projectoDisabled={!filters.cliente || engagements.isLoading}
        respDisabled={accessibleMembers.isLoading}
        countLabel={countLabel}
        showOpenBoard={showOpenBoard}
        onOpenBoard={() => router.push(`/clientes/${filters.cliente}/projetos/${filters.projeto}`)}
      />

      <div className="flex-1 overflow-auto p-6">
        {all.isLoading ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <div className="h-40 w-full max-w-4xl animate-pulse rounded-xl border border-border bg-card" />
          </div>
        ) : all.isError ? (
          <BoardError onRetry={() => all.refetch()} />
        ) : tasks.length === 0 ? (
          hasAnyFilter(filters) ? (
            <EmptyState
              icon={<SearchX className="size-5" />}
              title="Nenhuma tarefa bate nos filtros"
              desc="Ajuste ou limpe os filtros pra ver mais."
              action={<Button variant="secondary" onClick={() => navigate({ ...DEFAULT_FILTERS })}>Limpar filtros</Button>}
            />
          ) : (
            <EmptyState
              icon={<ListTodo className="size-5" />}
              title="Você não tem tarefas"
              desc="Quando houver tarefas nos seus clientes, elas aparecem aqui."
            />
          )
        ) : (
          <div className="mx-auto max-w-5xl">
            <GlobalTaskTable
              tasks={tasks}
              membersById={membersById}
              clientsById={clientsById}
              engagementsById={engagementsById}
              showContext={showContext}
              onOpenTask={(id) => navigate(filters, { task: id, push: true })}
            />
          </div>
        )}
      </div>

      <TaskDetailDialog
        taskId={taskParam}
        members={openedMembers.data ?? []}
        onOpenChange={(o) => !o && navigate(filters, { task: null })}
      />
    </div>
  );
}

function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-medium tracking-tight">{title}</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">{desc}</p>
      </div>
      {action}
    </div>
  );
}
