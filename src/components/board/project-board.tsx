"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { toast } from "@/components/ui/toast";
import { ArrowLeft, ChevronDown, FolderX, ListChecks, Loader2, X } from "lucide-react";
import { PERMISSIONS, type TaskStatus } from "@sistema-tasks/contracts";
import { useProject, useProjects } from "@/lib/hooks/use-projects";
import { generalEngagementId } from "@/lib/engagements";
import { useEngagements } from "@/lib/hooks/use-engagements";
import { useEngagementTasks, useCreateEngagementTask } from "@/lib/hooks/use-engagement-board";
import { useBoardSelection } from "@/lib/hooks/use-board-selection";
import { useProjectMembers } from "@/lib/hooks/use-members";
import { useCan } from "@/lib/hooks/use-can";
import { httpStatus } from "@/lib/http-error";
import { filterTasks } from "@/lib/filter";
import {
  type BoardFilters,
  EMPTY_BOARD_FILTERS,
  boardFiltersEqual,
  hasAnyBoardFilter,
  hasBoardFilterExceptStatus,
  parseBoardFilters,
  readAppliedPresetId,
  writeAppliedPresetId,
} from "@/lib/board-filters";
import { useBoardPresets, type Preset } from "@/lib/hooks/use-board-filters";
import { BoardFilterStrip, PresetDialogs, type PresetDialogState } from "@/components/board/board-filters-ui";
import { LiveByTaskProvider } from "@/components/query-bar";
import { KanbanBoard } from "@/components/board/kanban-board";
import { TaskList } from "@/components/board/task-list";
import { TaskCalendar } from "@/components/board/task-calendar";
import { CreateTaskDialog } from "@/components/board/create-task-dialog";
import { BulkActionBar } from "@/components/board/bulk-action-bar";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
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

/** Busca local por título (sem acento e sem diferenciar maiúsculas). */
const normText = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

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
  const [addInitialTitle, setAddInitialTitle] = useState(""); // título vindo do quick-add ao "abrir completo"
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_BOARD_FILTERS);
  const [search, setSearch] = useState(""); // busca local por título (a faixa de filtros); não é salva nos presets
  const [view, setView] = useState<ViewKey>("kanban");
  const [sheetOpen, setSheetOpen] = useState(false); // sheet do header no mobile [shell-mobile]
  const [dialog, setDialog] = useState<PresetDialogState>({ kind: "none" });

  const presets = useBoardPresets(clientId);

  // Abrir tarefa = navegar pra tela dedicada (o `from` faz o "voltar" retornar a este board). [tela-detalhe-tarefa]
  const boardPath = `/clientes/${clientId}/projetos/${engagementId}`;
  const openTask = (id: string) => router.push(`/tarefas/${id}?from=${encodeURIComponent(boardPath)}`, { scroll: false });
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
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const membersById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m.name])), [members]);
  const list = engagements.data ?? [];
  const current = list.find((e) => e.id === engagementId) ?? null;

  // Criar rápido: quick-add inline na coluna (cria quieto, sem toast em série) + "abrir completo". [criar-mais-rapido]
  const canCreate = useCan(PERMISSIONS.tarefas_criar);
  const canSeeGlobal = useCan(PERMISSIONS.tarefas_ver_globais); // fonte do estado vivo: feed da equipe ou /mine
  const createTask = useCreateEngagementTask(engagementId);
  const openCreate = (status: TaskStatus, initialTitle?: string) => {
    setAddInitialTitle(initialTitle ?? "");
    setAddStatus(status);
  };
  const quickAdd = async (status: TaskStatus, title: string) => {
    const created = await createTask.mutateAsync({ title, status, quiet: true });
    // avisa só se a nova tarefa REALMENTE some pelo filtro atual (ex.: "Sem responsável"/"Média" a mantêm
    // visível). `id` fixo evita empilhar toasts na criação em série. [RF-11, review]
    if (filterTasks([created], filters, { ignoreStatus: kanban }).length === 0 || (needle && !normText(created.title).includes(needle))) {
      toast.message("Tarefa criada, mas oculta pelo filtro atual.", { id: "quickadd-oculta" });
    }
  };

  // No Quadro a etapa (status) é ignorada (as colunas já são o status). [RF-3]
  const kanban = effectiveView === "kanban";
  const needle = normText(search.trim());
  const visibleTasks = useMemo(() => {
    const filtered = filterTasks(tasks.data ?? [], filters, { ignoreStatus: kanban });
    return needle ? filtered.filter((t) => normText(t.title).includes(needle)) : filtered;
  }, [tasks.data, filters, kanban, needle]);

  // Seleção múltipla + ações em massa (lógica extraída pro hook — comportamento idêntico). [T8]
  const {
    selectMode,
    count,
    canSelect,
    canDelete,
    canMove,
    busy,
    deleting,
    selectBtnRef,
    isSelected,
    selectMany,
    allVisibleSelected,
    enterOrExit,
    exit,
    handleToggle,
    toggleAllVisible,
    toggleColumn,
    confirmBulk,
    setConfirmBulk,
    doBulkDelete,
    doBulkMove,
  } = useBoardSelection({
    clientId,
    engagementId,
    effectiveView,
    allTasks: tasks.data ?? [],
    visibleTasks,
  });

  // Preset "aplicado" = aquele cujos filtros batem exatamente com os atuais. [Versão B — sem "modificado"]
  const activePresetId = useMemo(() => {
    const found = (presets.data ?? []).find((p) => boardFiltersEqual(parseBoardFilters(p.filters), filters));
    return found?.id ?? null;
  }, [presets.data, filters]);

  // Reinicialização por cliente: ao trocar de cliente, zera e reaplica o preset lembrado (F5/RF-23).
  const initedClientRef = useRef<string | null>(null);
  const userTouchedRef = useRef(false); // usuário mexeu num filtro → init não pisa por cima
  // Toda mudança MANUAL de filtro passa por aqui (marca interação). setFilters cru fica p/ init/programático.
  const changeFilters: typeof setFilters = (next) => {
    userTouchedRef.current = true;
    setFilters(next);
  };
  useEffect(() => {
    if (initedClientRef.current !== clientId) {
      setFilters(EMPTY_BOARD_FILTERS); // troca de cliente → limpa
      userTouchedRef.current = false;
    }
  }, [clientId]);
  useEffect(() => {
    if (initedClientRef.current === clientId) return; // já inicializou este cliente
    if (!(presets.isSuccess || presets.isError)) return; // espera a lista assentar (sucesso ou erro)
    if (!userTouchedRef.current) {
      const storedId = readAppliedPresetId(clientId);
      const p = storedId ? (presets.data ?? []).find((x) => x.id === storedId) : undefined;
      if (p) setFilters(parseBoardFilters(p.filters));
    }
    initedClientRef.current = clientId;
  }, [clientId, presets.isSuccess, presets.isError, presets.data]);
  // Persiste o preset aplicado (só depois de inicializar, pra não apagar o lembrado antes de lê-lo).
  useEffect(() => {
    if (initedClientRef.current !== clientId) return;
    writeAppliedPresetId(clientId, activePresetId);
  }, [clientId, activePresetId]);

  const applyPreset = (p: Preset) => {
    const f = parseBoardFilters(p.filters);
    // Responsável salvo saiu do cliente → cai pra "todos" e avisa (só quando já sei os membros). [RF-17]
    if (membersQuery.isSuccess && f.resp && f.resp !== "none" && !members.some((m) => m.id === f.resp)) {
      delete f.resp;
      toast.message("O responsável salvo não está mais neste cliente — apliquei o resto do filtro.");
    }
    changeFilters(f);
  };

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
        <div className="flex size-12 items-center justify-center rounded-sm border border-border bg-card text-muted-foreground">
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
    { key: "kanban", label: "Quadro" },
    { key: "lista", label: "Lista" },
    { key: "calendario", label: "Calendário" },
    ...(canSeeCost ? [{ key: "custo", label: "Custo" } as const] : []),
  ] as { key: ViewKey; label: string }[];
  const renderTabs = (containerClass: string) => (
    <div className={containerClass}>
      <ToggleButtonGroup
        aria-label="Visualização"
        selectionMode="single"
        disallowEmptySelection
        size="sm"
        selectedKeys={new Set([effectiveView])}
        onSelectionChange={(keys) => {
          const key = [...keys][0];
          if (key != null && key !== effectiveView) setView(String(key) as ViewKey);
        }}
      >
        {VIEWS.map((v) => (
          <ToggleButton key={v.key} id={v.key} className="min-h-9 px-3 text-[12.5px] font-semibold data-[selected=true]:bg-foreground data-[selected=true]:text-background max-md:min-h-11">
            {v.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );

  const total = tasks.data?.length ?? 0;
  const filtering = visibleTasks.length !== total;
  const canSave = hasAnyBoardFilter(filters);

  const clienteOptions = (clients.data ?? []).map((c) => ({ value: c.id, label: c.name }));
  const projetoOptions = list.map((e) => ({ value: e.id, label: e.name }));

  return (
    <LiveByTaskProvider canGlobal={canSeeGlobal}>
      {/* ---------- MOBILE header (< lg): voltar + breadcrumb/sheet + abas roláveis ---------- */}
      <header className="flex flex-col gap-2 border-b border-border px-4 py-2.5 lg:hidden">
        <div className="flex items-center gap-2">
          <Button variant="unstyled"
            type="button"
            aria-label="Voltar para o cliente"
            onClick={() => router.push(`/clientes/${clientId}`)}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <Button variant="unstyled"
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[12.5px] outline-none transition-colors hover:border-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="truncate">{project.data?.name ?? "Cliente"}</span>
            <span className="shrink-0 text-muted-foreground/60">›</span>
            <span className="truncate text-muted-foreground">{current?.name ?? "Projeto"}</span>
            <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </Button>
          {canSelect && (
            <Button variant="unstyled"
              type="button"
              aria-pressed={selectMode}
              aria-label={selectMode ? "Cancelar seleção" : "Selecionar tarefas"}
              onClick={enterOrExit}
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-lg border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                selectMode ? "border-primary bg-surface-tertiary text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {selectMode ? <X className="size-4" aria-hidden /> : <ListChecks className="size-4" aria-hidden />}
            </Button>
          )}
        </div>
        {renderTabs("overflow-x-auto")}
      </header>

      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Cliente e projeto"
        footer={
          <Button variant="unstyled"
            type="button"
            onClick={() => setSheetOpen(false)}
            className="ml-auto inline-flex min-h-11 items-center rounded-md bg-secondary px-4 text-[13px] font-medium text-secondary-foreground outline-none transition-colors hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring"
          >
            Fechar
          </Button>
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
      </BottomSheet>

      {/* ---------- DESKTOP header (≥ lg): barra atual ---------- */}
      <header className="hidden flex-wrap items-center gap-3 border-b border-border px-6 py-3.5 lg:flex">
        <Button variant="unstyled"
          type="button"
          aria-label="Voltar para a página do cliente"
          onClick={() => router.push(`/clientes/${clientId}`)}
          className="inline-flex size-6 items-center justify-center rounded text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" />
        </Button>

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
          {filtering ? `${visibleTasks.length} de ${total}` : `${total} tarefas`}
        </span>

        {renderTabs("ml-1")}

        <div className="ml-auto flex items-center gap-2">
          {canSelect && (
            <Button variant="unstyled"
              ref={selectBtnRef}
              type="button"
              aria-pressed={selectMode}
              onClick={enterOrExit}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                selectMode
                  ? "border-primary bg-surface-tertiary text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {selectMode ? <X className="size-3.5" aria-hidden /> : <ListChecks className="size-3.5" aria-hidden />}
              {selectMode ? "Cancelar" : "Selecionar"}
            </Button>
          )}
        </div>
      </header>

      {effectiveView !== "custo" && (
        <BoardFilterStrip
          presets={presets.data ?? []}
          isLoading={presets.isLoading}
          isError={presets.isError}
          activeId={activePresetId}
          canSave={canSave}
          onApply={applyPreset}
          onSave={() => setDialog({ kind: "save" })}
          onRename={(p) => setDialog({ kind: "rename", preset: p })}
          onDelete={(p) => setDialog({ kind: "delete", preset: p })}
          onRetry={() => presets.refetch()}
          filters={filters}
          onChange={changeFilters}
          showStatus={!kanban}
          members={members}
          search={search}
          onSearchChange={setSearch}
        />
      )}

      {effectiveView === "custo" ? (
        <CostTab projectId={clientId} engagementId={engagementId} canSeeCost={canSeeCost} />
      ) : tasks.isLoading ? (
        <BoardSkeleton />
      ) : tasks.isError ? (
        <BoardError onRetry={() => tasks.refetch()} />
      ) : total === 0 ? (
        <EmptyTasks onAdd={() => setAddStatus("TODO")} />
      ) : visibleTasks.length === 0 && effectiveView !== "kanban" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma tarefa para este filtro.</p>
          <Button variant="secondary" onClick={() => { changeFilters(EMPTY_BOARD_FILTERS); setSearch(""); }}>
            Limpar filtros
          </Button>
        </div>
      ) : effectiveView === "lista" ? (
        <TaskList
          tasks={visibleTasks}
          membersById={membersById}
          onOpenTask={openTask}
          selectMode={selectMode}
          isSelected={isSelected}
          onToggleSelect={handleToggle}
          onSelectRange={selectMany}
          allSelected={allVisibleSelected}
          onToggleAll={toggleAllVisible}
        />
      ) : effectiveView === "calendario" ? (
        <TaskCalendar tasks={visibleTasks} onOpenTask={openTask} membersById={membersById} />
      ) : (
        <KanbanBoard
          tasks={visibleTasks}
          projectId={clientId}
          engagementId={engagementId}
          membersById={membersById}
          dragDisabled={hasBoardFilterExceptStatus(filters) || needle !== "" || selectMode}
          onOpenTask={openTask}
          onAddTask={openCreate}
          canCreate={canCreate}
          onQuickAdd={quickAdd}
          selectMode={selectMode}
          isSelected={isSelected}
          onToggleSelect={handleToggle}
          onToggleColumn={toggleColumn}
        />
      )}

      <PresetDialogs
        state={dialog}
        onClose={() => setDialog({ kind: "none" })}
        projectId={clientId}
        currentFilters={filters}
        presets={presets.data ?? []}
        activeId={activePresetId}
        onSavedApplied={(id) => {
          const p = (presets.data ?? []).find((x) => x.id === id);
          if (p) setFilters(parseBoardFilters(p.filters));
          writeAppliedPresetId(clientId, id);
        }}
        onDeletedApplied={() => writeAppliedPresetId(clientId, null)}
      />

      <CreateTaskDialog
        projectId={clientId}
        engagementId={engagementId}
        status={addStatus}
        initialTitle={addInitialTitle}
        members={members}
        canSeeCost={canSeeCost}
        onOpenChange={(o) => {
          if (!o) {
            setAddStatus(null);
            setAddInitialTitle("");
          }
        }}
      />

      {/* Ações em massa: barra flutuante (≥1 selecionada) + confirmação do excluir em lote. [acoes-em-massa] */}
      {selectMode && count > 0 && (
        <BulkActionBar
          count={count}
          canMove={canMove}
          canDelete={canDelete}
          pending={busy}
          onMoveTo={doBulkMove}
          onDelete={() => setConfirmBulk(true)}
          onClear={exit}
        />
      )}
      <ConfirmDialog
        open={confirmBulk}
        title={`Excluir ${count} ${count === 1 ? "tarefa" : "tarefas"}?`}
        description="As tarefas selecionadas serão removidas do quadro."
        reversible
        danger
        confirmLabel="Excluir"
        pendingLabel="Excluindo…"
        pending={deleting}
        onConfirm={doBulkDelete}
        onOpenChange={(o) => {
          if (!o) setConfirmBulk(false);
        }}
      />
    </LiveByTaskProvider>
  );
}
