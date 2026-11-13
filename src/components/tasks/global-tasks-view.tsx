"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PERMISSIONS, type TaskStatus } from "@sistema-tasks/contracts";
import { useMe } from "@/lib/hooks/use-me";
import { hasPermission } from "@/lib/hooks/use-can";
import { useProjects } from "@/lib/hooks/use-projects";
import { useEngagements } from "@/lib/hooks/use-engagements";
import { useAccessibleMembers } from "@/lib/hooks/use-members";
import { useAllTasks, useGlobalMoveTask } from "@/lib/hooks/use-all-tasks";
import { useTeamWorkflows } from "@/lib/hooks/use-workflow";
import { useNow } from "@/lib/hooks/use-now";
import {
  parseFilters,
  filtersToSearchParams,
  filtersToQuery,
  parseView,
  hasAnyFilter,
  writeStoredClientProject,
  filterByFluxo,
  DEFAULT_FILTERS,
  type GlobalFilters,
  type TaskView,
} from "@/lib/global-filters";
import { BoardSkeleton, BoardError, EmptyClients, RowsSkeleton } from "@/components/board/board-states";
import { KanbanBoard } from "@/components/board/kanban-board";
import { TaskCalendar } from "@/components/board/task-calendar";
import { TaskCardExtrasProvider } from "@/components/board/task-card";
import { buildLiveByTask, useMyOpenActions } from "@/components/query-bar";
import { GlobalFilterBar } from "./global-filter-bar";
import { GlobalTaskTable, type EngagementLite } from "./global-task-table";
import { GlobalCreateTaskDialog } from "./global-create-task-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const VIEW_STORAGE_KEY = "sdt_tarefas_view";

export function GlobalTasksView() {
  const router = useRouter();
  const sp = useSearchParams();
  const filters = useMemo(() => parseFilters(new URLSearchParams(sp.toString())), [sp]);

  // Gate da aba global: sem tarefas.ver_globais, não entra (redireciona quando o /me resolve). [tarefas-visao-global]
  // Título da aba, no mesmo padrão da Agora.
  useEffect(() => {
    const previous = document.title;
    document.title = "Tarefas · Corex Tasks";
    return () => { document.title = previous; };
  }, []);

  const me = useMe();
  const canView = hasPermission(me.data?.permissions, PERMISSIONS.tarefas_ver_globais);
  const canCreate = hasPermission(me.data?.permissions, PERMISSIONS.tarefas_criar); // gate do "+" [criar-mais-rapido RF-12]
  useEffect(() => {
    if (me.isSuccess && !canView) router.replace("/");
  }, [me.isSuccess, canView, router]);

  // Visualização: URL (?view) manda; senão a última escolhida (localStorage); senão Kanban (default). [design]
  const [storedView, setStoredView] = useState<TaskView | null>(null);
  useEffect(() => {
    try {
      setStoredView(parseView(localStorage.getItem(VIEW_STORAGE_KEY)));
    } catch {
      /* localStorage indisponível — segue no default */
    }
  }, []);
  const view: TaskView = parseView(sp.get("view")) ?? storedView ?? "kanban";
  const [addStatus, setAddStatus] = useState<TaskStatus | null>(null);

  const projects = useProjects();
  const clients = useMemo(() => projects.data ?? [], [projects.data]);
  const engagements = useEngagements(filters.cliente ?? null);
  const accessibleMembers = useAccessibleMembers();

  // No Kanban as colunas SÃO o status: ignora o facet de status e sempre mostra as 3 (senão arrastar
  // um card pra coluna fora do filtro faz ele sumir). [review UX M1]
  const query = useMemo(() => {
    const q = filtersToQuery(filters);
    if (view === "kanban") {
      delete q.status;
      q.includeDone = "true";
    }
    return q;
  }, [filters, view]);
  const all = useAllTasks(query);
  // Digitar em `q` troca a chave da consulta: em vez de piscar o esqueleto a cada busca, a lista anterior fica visível até a nova chegar.
  // Vale só quando o que mudou foi o `q` (outro filtro mostraria tarefas que não batem). `useAllTasks` é do F0 e não ganhou keepPreviousData.
  const baseKey = useMemo(() => JSON.stringify({ ...query, q: undefined }), [query]);
  const [lastShown, setLastShown] = useState<{ baseKey: string; data: NonNullable<typeof all.data> } | null>(null);
  if (all.data && lastShown?.data !== all.data) setLastShown({ baseKey, data: all.data });
  const shown = all.data ?? (lastShown?.baseKey === baseKey ? lastShown.data : undefined);
  const refreshing = !all.data && !!shown && all.isFetching;
  const move = useGlobalMoveTask(query);

  // Estado vivo: o feed da equipe (mesmo cache da Agora) cruzado com os pedidos abertos para mim. Alimenta a linha viva
  // do cartão e da tabela, o filtro de estado do fluxo (RF23) e as contagens das visões. Falha do feed = sem linha viva.
  const team = useTeamWorkflows({ enabled: canView });
  const myActions = useMyOpenActions();
  const now = useNow(30_000);
  const liveByTaskId = useMemo(() => buildLiveByTask(team.items, myActions, now), [team.items, myActions, now]);

  // Navega mantendo/limpando os params de filtro/view (sempre replace — filtro não é entrada de histórico). [RF-C1/E1]
  function navigate(next: GlobalFilters, opts?: { view?: TaskView }) {
    const params = filtersToSearchParams(next);
    const nextView = opts?.view ?? parseView(sp.get("view")) ?? undefined;
    if (nextView) params.set("view", nextView);
    const qs = params.toString();
    router.replace(qs ? `/tarefas?${qs}` : "/tarefas");
  }

  function switchView(v: TaskView) {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {
      /* sem persistência, tudo bem */
    }
    navigate(filters, { view: v });
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

  // Lembra Cliente+Projeto pra sidebar recarregar o filtro ao voltar pra aba. Captura de brinde
  // o "Limpar filtros" (grava vazio) e o drop de id morto do saneador. [tarefas-persistir-filtro]
  useEffect(() => {
    writeStoredClientProject(filters.cliente, filters.projeto);
  }, [filters.cliente, filters.projeto]);

  const clientsById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c.name])), [clients]);
  const engagementsById = useMemo<Record<string, EngagementLite>>(
    () => Object.fromEntries((engagements.data ?? []).map((e) => [e.id, { name: e.name, isGeneral: e.isGeneral }])),
    [engagements.data],
  );
  const membersById = useMemo(
    () => Object.fromEntries((accessibleMembers.data ?? []).map((m) => [m.id, m.name])),
    [accessibleMembers.data],
  );

  // RF23: com `fluxo` ativo, só aparecem tarefas cujo fluxo está no estado pedido; tarefa sem fluxo some.
  const tasks = useMemo(() => filterByFluxo(shown?.tasks ?? [], liveByTaskId, filters.fluxo), [shown, filters.fluxo, liveByTaskId]);
  const fluxoLoading = !!filters.fluxo && team.isLoading;
  const fluxoError = !!filters.fluxo && team.isError;
  const projectNameById = useMemo(() => {
    const out: Record<string, string> = {};
    for (const item of team.items) if (item.projectId && item.projectName) out[item.projectId] = item.projectName;
    for (const [id, e] of Object.entries(engagementsById)) if (!e.isGeneral) out[id] = e.name;
    return out;
  }, [team.items, engagementsById]);
  const count = tasks.length;
  const countLabel = all.isLoading && !shown
    ? ""
    : shown?.hasMore
      ? `${count}+ tarefas`
      : `${count} ${count === 1 ? "tarefa" : "tarefas"}`;
  // Contagem na aba só onde é exata para a lista atual: a visão ativa, sem busca por texto e sem "mais resultados".
  // As demais abas não mostram número (contagens do feed e da lista seriam de origens diferentes).
  const activeCount = !all.isLoading && !all.isError && !shown?.hasMore && !filters.q && !refreshing && !fluxoLoading && !fluxoError ? count : undefined;
  const showOpenBoard = !!filters.cliente && !!filters.projeto;
  const showContext = !(filters.cliente && filters.projeto);
  const showClient = !filters.cliente; // kicker de cliente só quando cruza clientes

  // Abrir tarefa = navegar pra tela dedicada; `from` faz o "voltar" retornar à visão global filtrada.
  const openTask = (id: string) => {
    const qs = filtersToSearchParams(filters);
    const v = parseView(sp.get("view"));
    if (v) qs.set("view", v);
    const from = qs.toString() ? `/tarefas?${qs.toString()}` : "/tarefas";
    router.push(`/tarefas/${id}?from=${encodeURIComponent(from)}`, { scroll: false });
  };

  // ----- estados de topo (antes da barra) -----
  if (me.isError) return <BoardError onRetry={() => me.refetch()} />; // não trava no spinner se o /me falhar [review]
  if (me.isLoading || !canView) {
    return (
      <div role="status" aria-label="Carregando tarefas" className="flex flex-1 flex-col gap-5 p-6">
        <span className="sr-only">Carregando suas tarefas…</span>
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-9 w-full max-w-lg" />
        {[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-14 w-full" />)}
      </div>
    );
  }
  if (projects.isLoading) return <BoardSkeleton />;
  if (projects.isError) return <BoardError onRetry={() => projects.refetch()} />;
  if (clients.length === 0) return <EmptyClients onCreate={() => router.push("/clientes")} />;

  let body: React.ReactNode;
  if ((all.isLoading && !shown) || fluxoLoading) {
    body = view === "kanban" ? <BoardSkeleton /> : <RowsSkeleton />;
  } else if (all.isError) {
    body = <BoardError onRetry={() => all.refetch()} />;
  } else if (fluxoError) {
    body = <BoardError onRetry={() => team.refetch()} />;
  } else if (tasks.length === 0) {
    body = hasAnyFilter(filters) ? (
      <EmptyState
        title={filters.q ? "Nenhuma tarefa encontrada" : "Nenhuma tarefa bate nos filtros"}
        desc={filters.q ? "Nenhum título combina com a busca e os filtros atuais." : "Ajuste ou limpe os filtros pra ver mais."}
        action={<Button variant="secondary" className="max-md:min-h-11" onClick={() => navigate({ ...DEFAULT_FILTERS })}>Limpar filtros</Button>}
      />
    ) : (
      <EmptyState
        title="Você não tem tarefas"
        desc="Quando houver tarefas nos seus clientes, elas aparecem aqui."
      />
    );
  } else if (view === "kanban") {
    body = (
      <KanbanBoard
        tasks={tasks}
        projectId=""
        membersById={membersById}
        onMove={move.mutateAsync}
        clientNameById={clientsById}
        showClient={showClient}
        onOpenTask={openTask}
        onAddTask={setAddStatus}
        canCreate={canCreate}
      />
    );
  } else if (view === "calendario") {
    body = <TaskCalendar tasks={tasks} onOpenTask={openTask} membersById={membersById} />;
  } else {
    body = (
      <div className="flex-1 overflow-auto px-4 pb-10 pt-1 lg:px-6">
        <GlobalTaskTable
          tasks={tasks}
          membersById={membersById}
          clientsById={clientsById}
          engagementsById={engagementsById}
          showContext={showContext}
          onOpenTask={openTask}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <GlobalFilterBar
        filters={filters}
        onChange={(f) => navigate(f)}
        view={view}
        onView={switchView}
        clients={clients}
        engagements={engagements.data ?? []}
        members={accessibleMembers.data ?? []}
        projectoDisabled={!filters.cliente || engagements.isLoading}
        respDisabled={accessibleMembers.isLoading}
        countLabel={countLabel}
        showOpenBoard={showOpenBoard}
        onOpenBoard={() => router.push(`/clientes/${encodeURIComponent(filters.cliente!)}/projetos/${encodeURIComponent(filters.projeto!)}`)}
        meId={me.data?.userId}
        activeCount={activeCount}
      />

      <TaskCardExtrasProvider value={{ live: liveByTaskId, now, engagementNameById: projectNameById }}>
        <div aria-busy={refreshing || undefined} className="flex min-h-0 flex-1 flex-col">{body}</div>
      </TaskCardExtrasProvider>

      <GlobalCreateTaskDialog status={addStatus} onOpenChange={(o) => !o && setAddStatus(null)} />
    </div>
  );
}

/** Estado vazio: texto à esquerda (título + uma linha), ação abaixo; sem ícone em moldura. */
function EmptyState({ title, desc, action }: { title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-start gap-3 px-4 py-10 text-left lg:px-6">
      <div>
        <h2 className="text-base font-bold tracking-tight">{title}</h2>
        <p className="mt-1 max-w-md text-sm text-muted">{desc}</p>
      </div>
      {action}
    </div>
  );
}
