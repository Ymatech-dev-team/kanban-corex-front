"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ListTodo, Loader2, SearchX } from "lucide-react";
import { PERMISSIONS, type TaskStatus } from "@sistema-tasks/contracts";
import { useMe } from "@/lib/hooks/use-me";
import { hasPermission } from "@/lib/hooks/use-can";
import { useProjects } from "@/lib/hooks/use-projects";
import { useEngagements } from "@/lib/hooks/use-engagements";
import { useProjectMembers, useAccessibleMembers } from "@/lib/hooks/use-members";
import { useTaskDetail } from "@/lib/hooks/use-tasks";
import { useAllTasks, useGlobalMoveTask } from "@/lib/hooks/use-all-tasks";
import {
  parseFilters,
  filtersToSearchParams,
  filtersToQuery,
  parseView,
  hasAnyFilter,
  DEFAULT_FILTERS,
  type GlobalFilters,
  type TaskView,
} from "@/lib/global-filters";
import { BoardSkeleton, BoardError, EmptyClients } from "@/components/board/board-states";
import { KanbanBoard } from "@/components/board/kanban-board";
import { TaskCalendar } from "@/components/board/task-calendar";
import { TaskDetailDialog } from "@/components/board/task-detail-dialog";
import { GlobalFilterBar } from "./global-filter-bar";
import { GlobalTaskTable, type EngagementLite } from "./global-task-table";
import { GlobalCreateTaskDialog } from "./global-create-task-dialog";
import { Button } from "@/components/ui/button";

const VIEW_STORAGE_KEY = "sdt_tarefas_view";

export function GlobalTasksView() {
  const router = useRouter();
  const sp = useSearchParams();
  const filters = useMemo(() => parseFilters(new URLSearchParams(sp.toString())), [sp]);
  const taskParam = sp.get("task");

  // Gate da aba global: sem tarefas.ver_globais, não entra (redireciona quando o /me resolve). [tarefas-visao-global]
  const me = useMe();
  const canView = hasPermission(me.data?.permissions, PERMISSIONS.tarefas_ver_globais);
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
  const clients = projects.data ?? [];
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
  const move = useGlobalMoveTask(query);

  // Detalhe in-place: resolve o cliente da tarefa aberta p/ passar os membros DELE ao dialog. [RF-E7]
  const openedDetail = useTaskDetail(taskParam);
  const openedMembers = useProjectMembers(openedDetail.data?.projectId ?? null);

  // Navega mantendo/limpando params. filtro → replace; abrir tarefa → push; view preservada. [RF-C1/E1]
  function navigate(next: GlobalFilters, opts?: { task?: string | null; push?: boolean; view?: TaskView }) {
    const params = filtersToSearchParams(next);
    const nextView = opts?.view ?? parseView(sp.get("view")) ?? undefined;
    const task = opts?.task === undefined ? taskParam : opts.task;
    if (nextView) params.set("view", nextView);
    if (task) params.set("task", task);
    const qs = params.toString();
    const url = qs ? `/tarefas?${qs}` : "/tarefas";
    if (opts?.push) router.push(url);
    else router.replace(url);
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
  const countLabel = all.isLoading
    ? ""
    : all.data?.hasMore
      ? `${count}+ tarefas`
      : `${count} ${count === 1 ? "tarefa" : "tarefas"}`;
  const showOpenBoard = !!filters.cliente && !!filters.projeto;
  const showContext = !(filters.cliente && filters.projeto);
  const showClient = !filters.cliente; // kicker de cliente só quando cruza clientes

  const openTask = (id: string) => navigate(filters, { task: id, push: true });

  // ----- estados de topo (antes da barra) -----
  if (me.isError) return <BoardError onRetry={() => me.refetch()} />; // não trava no spinner se o /me falhar [review]
  if (me.isLoading || !canView) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (projects.isLoading) return <BoardSkeleton />;
  if (projects.isError) return <BoardError onRetry={() => projects.refetch()} />;
  if (clients.length === 0) return <EmptyClients onCreate={() => router.push("/clientes")} />;

  let body: React.ReactNode;
  if (all.isLoading) {
    body = <BoardSkeleton />;
  } else if (all.isError) {
    body = <BoardError onRetry={() => all.refetch()} />;
  } else if (tasks.length === 0) {
    body = hasAnyFilter(filters) ? (
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
    );
  } else if (view === "kanban") {
    body = (
      <KanbanBoard
        tasks={tasks}
        projectId=""
        membersById={membersById}
        onMove={move.mutate}
        clientNameById={clientsById}
        showClient={showClient}
        onOpenTask={openTask}
        onAddTask={setAddStatus}
      />
    );
  } else if (view === "calendario") {
    body = <TaskCalendar tasks={tasks} onOpenTask={openTask} />;
  } else {
    body = (
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-5xl">
          <GlobalTaskTable
            tasks={tasks}
            membersById={membersById}
            clientsById={clientsById}
            engagementsById={engagementsById}
            showContext={showContext}
            onOpenTask={openTask}
          />
        </div>
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
        onOpenBoard={() => router.push(`/clientes/${filters.cliente}/projetos/${filters.projeto}`)}
      />

      <div className="flex min-h-0 flex-1 flex-col">{body}</div>

      <TaskDetailDialog
        taskId={taskParam}
        members={openedMembers.data ?? []}
        onOpenChange={(o) => !o && navigate(filters, { task: null })}
      />
      <GlobalCreateTaskDialog status={addStatus} onOpenChange={(o) => !o && setAddStatus(null)} />
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
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
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
