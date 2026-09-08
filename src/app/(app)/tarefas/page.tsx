"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { TaskStatus } from "@sistema-tasks/contracts";
import { useProjects, useProject } from "@/lib/hooks/use-projects";
import { useTasks } from "@/lib/hooks/use-tasks";
import { useProjectMembers } from "@/lib/hooks/use-members";
import { useBoardNav } from "@/lib/board-nav";
import { filterByAssignee, type AssigneeFilter } from "@/lib/filter";
import { KanbanBoard } from "@/components/board/kanban-board";
import { TaskList } from "@/components/board/task-list";
import { TaskCalendar } from "@/components/board/task-calendar";
import { AssigneeFilter as AssigneeFilterControl } from "@/components/board/assignee-filter";
import { CreateTaskDialog } from "@/components/board/create-task-dialog";
import { TaskDetailDialog } from "@/components/board/task-detail-dialog";
import { CostTab } from "@/components/board/cost-tab";
import { BoardSkeleton, BoardError, EmptyClients, EmptyTasks } from "@/components/board/board-states";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ViewKey = "kanban" | "lista" | "calendario" | "custo";

export default function TarefasPage() {
  const router = useRouter();
  const projects = useProjects();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addStatus, setAddStatus] = useState<TaskStatus | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>({ type: "all" });
  const [view, setView] = useState<ViewKey>("kanban");

  useEffect(() => {
    if (!selectedId && projects.data?.length) setSelectedId(projects.data[0].id);
  }, [projects.data, selectedId]);

  // Trocar de cliente zera o filtro (o responsável selecionado pode não existir no novo).
  useEffect(() => {
    setAssigneeFilter({ type: "all" });
  }, [selectedId]);

  // Ponte (sino / resumo / Clientes) → abrir um cliente e, se houver, uma tarefa.
  const nav = useBoardNav();
  useEffect(() => {
    if (!nav.pending) return;
    setSelectedId(nav.pending.projectId);
    setOpenTaskId(nav.pending.taskId ?? null);
    nav.consume();
  }, [nav]);

  // canSeeCost vem do detalhe do cliente (permissão POR cliente). undefined durante o load = tratado como "sem".
  const project = useProject(selectedId);
  const canSeeCost = project.data?.canSeeCost === true;
  // View derivada: se cair num cliente sem custo com a aba Custo ativa, mostra kanban (sem race com o fetch).
  const effectiveView: ViewKey = view === "custo" && !canSeeCost ? "kanban" : view;
  // Saneamento do estado guardado — só quando o cliente já resolveu e não tem direito.
  useEffect(() => {
    if (view === "custo" && project.isSuccess && !canSeeCost) setView("kanban");
  }, [view, project.isSuccess, canSeeCost]);

  const tasks = useTasks(selectedId);
  const membersQuery = useProjectMembers(selectedId);
  const members = membersQuery.data ?? [];
  const membersById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m.name])), [members]);
  const selected = projects.data?.find((p) => p.id === selectedId) ?? null;
  const visibleTasks = useMemo(
    () => filterByAssignee(tasks.data ?? [], assigneeFilter),
    [tasks.data, assigneeFilter],
  );

  if (projects.isLoading) return <BoardSkeleton />;
  if (projects.isError) return <BoardError onRetry={() => projects.refetch()} />;
  if ((projects.data?.length ?? 0) === 0) {
    return <EmptyClients onCreate={() => router.push("/clientes")} />;
  }

  return (
    <>
      <header className="flex items-center gap-4 border-b border-border px-6 py-3.5">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 text-base font-medium tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
            {selected?.name ?? "Selecione um cliente"}
            <ChevronDown className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {projects.data!.map((p) => (
              <DropdownMenuItem key={p.id} active={p.id === selectedId} onSelect={() => setSelectedId(p.id)}>
                {p.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
          {assigneeFilter.type === "all"
            ? `${tasks.data?.length ?? 0} tarefas`
            : `${visibleTasks.length} de ${tasks.data?.length ?? 0}`}
        </span>

        <div className="ml-1 flex gap-0.5 rounded-lg border border-border bg-card p-[3px] text-[12.5px]">
          {([
            { key: "kanban", label: "Kanban" },
            { key: "lista", label: "Lista" },
            { key: "calendario", label: "Calendário" },
            ...(canSeeCost ? [{ key: "custo", label: "Custo" } as const] : []),
          ] as { key: ViewKey; label: string }[]).map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              aria-current={effectiveView === v.key ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                effectiveView === v.key
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground/60 hover:text-muted-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        {members.length > 0 && (
          <div className="ml-auto">
            <AssigneeFilterControl members={members} value={assigneeFilter} onChange={setAssigneeFilter} />
          </div>
        )}
      </header>

      {effectiveView === "custo" ? (
        <CostTab projectId={selectedId!} canSeeCost={canSeeCost} />
      ) : tasks.isLoading ? (
        <BoardSkeleton />
      ) : tasks.isError ? (
        <BoardError onRetry={() => tasks.refetch()} />
      ) : (tasks.data?.length ?? 0) === 0 ? (
        <EmptyTasks onAdd={() => setAddStatus("TODO")} />
      ) : effectiveView === "lista" ? (
        <TaskList tasks={visibleTasks} membersById={membersById} onOpenTask={setOpenTaskId} />
      ) : effectiveView === "calendario" ? (
        <TaskCalendar tasks={visibleTasks} onOpenTask={setOpenTaskId} />
      ) : (
        <KanbanBoard
          tasks={visibleTasks}
          projectId={selectedId!}
          membersById={membersById}
          dragDisabled={assigneeFilter.type !== "all"}
          onOpenTask={setOpenTaskId}
          onAddTask={setAddStatus}
        />
      )}

      {selectedId && (
        <CreateTaskDialog
          projectId={selectedId}
          status={addStatus}
          members={members}
          onOpenChange={(o) => !o && setAddStatus(null)}
        />
      )}
      <TaskDetailDialog taskId={openTaskId} members={members} onOpenChange={(o) => !o && setOpenTaskId(null)} />
    </>
  );
}
