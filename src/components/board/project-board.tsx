"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, FolderX, Loader2 } from "lucide-react";
import type { TaskStatus } from "@sistema-tasks/contracts";
import { useProject } from "@/lib/hooks/use-projects";
import { useEngagements } from "@/lib/hooks/use-engagements";
import { useEngagementTasks } from "@/lib/hooks/use-engagement-board";
import { useProjectMembers } from "@/lib/hooks/use-members";
import { httpStatus } from "@/lib/http-error";
import { filterByAssignee, type AssigneeFilter } from "@/lib/filter";
import { KanbanBoard } from "@/components/board/kanban-board";
import { TaskList } from "@/components/board/task-list";
import { TaskCalendar } from "@/components/board/task-calendar";
import { AssigneeFilter as AssigneeFilterControl } from "@/components/board/assignee-filter";
import { CreateTaskDialog } from "@/components/board/create-task-dialog";
import { TaskDetailDialog } from "@/components/board/task-detail-dialog";
import { CostTab } from "@/components/board/cost-tab";
import { BoardSkeleton, BoardError, EmptyTasks } from "@/components/board/board-states";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ViewKey = "kanban" | "lista" | "calendario" | "custo";

export function ProjectBoard({
  clientId,
  engagementId,
  initialTaskId,
}: {
  clientId: string;
  engagementId: string;
  initialTaskId?: string | null;
}) {
  const router = useRouter();
  const project = useProject(clientId);
  const engagements = useEngagements(clientId);
  const [addStatus, setAddStatus] = useState<TaskStatus | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(initialTaskId ?? null);
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>({ type: "all" });
  const [view, setView] = useState<ViewKey>("kanban");

  const canSeeCost = project.data?.canSeeCost === true;
  const effectiveView: ViewKey = view === "custo" && !canSeeCost ? "kanban" : view;
  useEffect(() => {
    if (view === "custo" && project.isSuccess && !canSeeCost) setView("kanban");
  }, [view, project.isSuccess, canSeeCost]);

  const tasks = useEngagementTasks(engagementId);
  const membersQuery = useProjectMembers(clientId);
  const members = membersQuery.data ?? [];
  const membersById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m.name])), [members]);
  const list = engagements.data ?? [];
  const current = list.find((e) => e.id === engagementId) ?? null;
  const visibleTasks = useMemo(
    () => filterByAssignee(tasks.data ?? [], assigneeFilter),
    [tasks.data, assigneeFilter],
  );

  // Cliente inexistente/sem acesso, ou projeto que não existe nele → "não encontrado".
  const clientNotFound = project.isError && [404, 403].includes(httpStatus(project.error) ?? 0);
  const engNotFound = engagements.isSuccess && !current;

  if (project.isLoading || engagements.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (clientNotFound || engNotFound) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
          <FolderX className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-medium tracking-tight">Projeto não encontrado</h2>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">Ele não existe ou você não tem acesso a ele.</p>
        </div>
        <Button variant="secondary" onClick={() => router.push(`/clientes/${clientId}`)}>
          Voltar para o cliente
        </Button>
      </div>
    );
  }
  if (project.isError || engagements.isError) {
    return <BoardError onRetry={() => { project.refetch(); engagements.refetch(); }} />;
  }

  return (
    <>
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3.5">
        <button
          type="button"
          aria-label={`Voltar para ${project.data?.name ?? "o cliente"}`}
          onClick={() => router.push(`/clientes/${clientId}`)}
          className="inline-flex items-center gap-1.5 rounded text-[12.5px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-3.5" />
          {project.data?.name ?? "Cliente"}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex max-w-[16rem] items-center gap-2 truncate text-base font-medium tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
            <span className="truncate">{current?.name ?? "Projeto"}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {list.map((e) => (
              <DropdownMenuItem
                key={e.id}
                active={e.id === engagementId}
                onSelect={() => router.push(`/clientes/${clientId}/projetos/${e.id}`)}
              >
                {e.name}
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
        <CostTab projectId={clientId} engagementId={engagementId} canSeeCost={canSeeCost} />
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
          projectId={clientId}
          engagementId={engagementId}
          membersById={membersById}
          dragDisabled={assigneeFilter.type !== "all"}
          onOpenTask={setOpenTaskId}
          onAddTask={setAddStatus}
        />
      )}

      <CreateTaskDialog
        projectId={clientId}
        engagementId={engagementId}
        status={addStatus}
        members={members}
        onOpenChange={(o) => !o && setAddStatus(null)}
      />
      <TaskDetailDialog taskId={openTaskId} members={members} onOpenChange={(o) => !o && setOpenTaskId(null)} />
    </>
  );
}
