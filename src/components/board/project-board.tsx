"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, FolderX, ListFilter, Loader2 } from "lucide-react";
import type { TaskStatus } from "@sistema-tasks/contracts";
import { useProject, useProjects } from "@/lib/hooks/use-projects";
import { generalEngagementId } from "@/lib/engagements";
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
import { CostTab } from "@/components/board/cost-tab";
import { BoardSkeleton, BoardError, EmptyTasks } from "@/components/board/board-states";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SheetSelect } from "@/components/ui/sheet-select";
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
  const clients = useProjects(); // clientes que o usuário acessa (o backend já filtra por permissão) [seletor de clientes]
  const engagements = useEngagements(clientId);
  const [addStatus, setAddStatus] = useState<TaskStatus | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>({ type: "all" });
  const [view, setView] = useState<ViewKey>("kanban");
  const [sheetOpen, setSheetOpen] = useState(false); // sheet do header no mobile [shell-mobile]

  // Abrir tarefa = navegar pra tela dedicada (o `from` faz o "voltar" retornar a este board). [tela-detalhe-tarefa]
  const boardPath = `/clientes/${clientId}/projetos/${engagementId}`;
  const openTask = (id: string) => router.push(`/tarefas/${id}?from=${encodeURIComponent(boardPath)}`);
  // Deep-links legados `?task=` (initialTaskId) redirecionam pra nova rota, preservando o board de origem.
  useEffect(() => {
    if (initialTaskId) router.replace(`/tarefas/${initialTaskId}?from=${encodeURIComponent(boardPath)}`);
  }, [initialTaskId, boardPath, router]);

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

  // ---- controles do header (compartilhados desktop + mobile) ----
  const VIEWS = [
    { key: "kanban", label: "Kanban" },
    { key: "lista", label: "Lista" },
    { key: "calendario", label: "Calendário" },
    ...(canSeeCost ? [{ key: "custo", label: "Custo" } as const] : []),
  ] as { key: ViewKey; label: string }[];
  const renderTabs = (containerClass: string) => (
    <div className={containerClass}>
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={() => setView(v.key)}
          aria-pressed={effectiveView === v.key}
          className={cn(
            "shrink-0 rounded-md px-3 py-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            effectiveView === v.key ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );

  // Responsável (filtro local) encodado como string pro SheetSelect do mobile.
  const respActive = assigneeFilter.type !== "all";
  const respSelected =
    assigneeFilter.type === "all" ? "all" : assigneeFilter.type === "none" ? "none" : `user:${assigneeFilter.id}`;
  const respOptions = [
    { value: "all", label: "Todos" },
    { value: "none", label: "Sem responsável" },
    ...members.map((m) => ({ value: `user:${m.id}`, label: m.name })),
  ];
  const setResp = (v: string | undefined) => {
    if (v === "none") setAssigneeFilter({ type: "none" });
    else if (v && v.startsWith("user:")) setAssigneeFilter({ type: "user", id: v.slice(5) });
    else setAssigneeFilter({ type: "all" });
  };
  const clienteOptions = (clients.data ?? []).map((c) => ({ value: c.id, label: c.name }));
  const projetoOptions = list.map((e) => ({ value: e.id, label: e.name }));
  const visibleCount = assigneeFilter.type === "all" ? (tasks.data?.length ?? 0) : visibleTasks.length;

  return (
    <>
      {/* ---------- MOBILE header (< lg): voltar + breadcrumb/sheet + abas roláveis ---------- */}
      <header className="flex flex-col gap-2 border-b border-border px-4 py-2.5 lg:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Voltar para o cliente"
            onClick={() => router.push(`/clientes/${clientId}`)}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex h-10 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[12.5px] outline-none transition-colors hover:border-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="truncate">{project.data?.name ?? "Cliente"}</span>
            <span className="shrink-0 text-muted-foreground/60">›</span>
            <span className="truncate text-muted-foreground">{current?.name ?? "Projeto"}</span>
            <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Filtros do quadro"
            onClick={() => setSheetOpen(true)}
            className={cn(
              "flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              respActive ? "border-muted-foreground/40 bg-accent text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <ListFilter className="size-3.5" aria-hidden />
            {respActive && (
              <span className="flex size-[15px] items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">1</span>
            )}
          </button>
        </div>
        {renderTabs("flex gap-0.5 overflow-x-auto rounded-lg border border-border bg-card p-[3px] text-[12.5px]")}
      </header>

      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Filtros do quadro"
        footer={
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            className="ml-auto inline-flex h-9 items-center rounded-lg bg-secondary px-4 text-[13px] font-medium text-secondary-foreground outline-none transition-colors hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver {visibleCount} {visibleCount === 1 ? "tarefa" : "tarefas"}
          </button>
        }
      >
        {(clients.data?.length ?? 0) > 1 && (
          <SheetSelect
            label="Cliente"
            selected={clientId}
            options={clienteOptions}
            onSelect={(v) => {
              if (v && v !== clientId) {
                setSheetOpen(false);
                router.push(`/clientes/${v}/projetos/${generalEngagementId(v)}`);
              }
            }}
          />
        )}
        <SheetSelect
          label="Projeto"
          selected={engagementId}
          options={projetoOptions}
          onSelect={(v) => {
            if (v && v !== engagementId) {
              setSheetOpen(false);
              router.push(`/clientes/${clientId}/projetos/${v}`);
            }
          }}
        />
        <SheetSelect label="Responsável" selected={respSelected} options={respOptions} onSelect={setResp} />
      </BottomSheet>

      {/* ---------- DESKTOP header (≥ lg): barra atual ---------- */}
      <header className="hidden flex-wrap items-center gap-3 border-b border-border px-6 py-3.5 lg:flex">
        <button
          type="button"
          aria-label="Voltar para a página do cliente"
          onClick={() => router.push(`/clientes/${clientId}`)}
          className="inline-flex size-6 items-center justify-center rounded text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" />
        </button>

        {/* Seletor de CLIENTE — só os clientes que o usuário acessa; some se houver apenas um. */}
        {(clients.data?.length ?? 0) > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex max-w-[14rem] items-center gap-1.5 truncate text-base font-medium tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
              <span className="truncate">{project.data?.name ?? "Cliente"}</span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
              {(clients.data ?? []).map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  active={c.id === clientId}
                  onSelect={() => router.push(`/clientes/${c.id}/projetos/${generalEngagementId(c.id)}`)}
                >
                  {c.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="max-w-[14rem] truncate text-base font-medium tracking-tight">
            {project.data?.name ?? "Cliente"}
          </span>
        )}

        <span className="text-muted-foreground/60">›</span>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex max-w-[14rem] items-center gap-1.5 truncate text-base font-medium tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
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

        {renderTabs("ml-1 flex gap-0.5 rounded-lg border border-border bg-card p-[3px] text-[12.5px]")}

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
      ) : visibleTasks.length === 0 && effectiveView !== "kanban" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma tarefa para este filtro de responsável.</p>
          <Button variant="secondary" onClick={() => setAssigneeFilter({ type: "all" })}>
            Limpar filtro
          </Button>
        </div>
      ) : effectiveView === "lista" ? (
        <TaskList tasks={visibleTasks} membersById={membersById} onOpenTask={openTask} />
      ) : effectiveView === "calendario" ? (
        <TaskCalendar tasks={visibleTasks} onOpenTask={openTask} membersById={membersById} />
      ) : (
        <KanbanBoard
          tasks={visibleTasks}
          projectId={clientId}
          engagementId={engagementId}
          membersById={membersById}
          dragDisabled={assigneeFilter.type !== "all"}
          onOpenTask={openTask}
          onAddTask={setAddStatus}
        />
      )}

      <CreateTaskDialog
        projectId={clientId}
        engagementId={engagementId}
        status={addStatus}
        members={members}
        canSeeCost={canSeeCost}
        onOpenChange={(o) => !o && setAddStatus(null)}
      />
    </>
  );
}
