"use client";

import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Check, Plus } from "lucide-react";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@sistema-tasks/contracts";
import { useMoveTask } from "@/lib/hooks/use-tasks";
import { positionForIndex } from "@/lib/position";
import { QuickAddInput } from "@/components/ui/quick-add-input";
import { TaskCard } from "./task-card";

const COLUMNS: { status: TaskStatus; label: string; dot: "todo" | "doing" | "done" }[] = [
  { status: "TODO", label: "A fazer", dot: "todo" },
  { status: "DOING", label: "Fazendo", dot: "doing" },
  { status: "DONE", label: "Feito", dot: "done" },
];

function Dot({ kind }: { kind: "todo" | "doing" | "done" }) {
  if (kind === "todo")
    return <span className="size-[9px] shrink-0 rounded-full border-[1.5px] border-muted-foreground" />;
  if (kind === "done") return <span className="size-[9px] shrink-0 rounded-full bg-muted-foreground/70" />;
  return (
    <span
      className="size-[9px] shrink-0 rounded-full border-[1.5px] border-foreground"
      style={{ background: "conic-gradient(var(--foreground) 0 50%, transparent 50% 100%)" }}
    />
  );
}

function SortableCard({
  task,
  onOpen,
  membersById,
  dragDisabled,
  clientName,
  selectMode,
  selected,
  onToggleSelect,
}: {
  task: Task;
  onOpen: () => void;
  membersById: Record<string, string>;
  dragDisabled?: boolean;
  clientName?: string;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: dragDisabled || selectMode, // no modo seleção o arrasto fica desligado [acoes-em-massa RF-1]
  });

  // Modo seleção: o card vira um toggle (clique/Enter/Espaço marca, nunca abre nem arrasta), com checkbox
  // menta no canto e realce menta na selecionada (distinto da barra-left âmbar de prazo). [RF-2/7]
  if (selectMode) {
    return (
      <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="scroll-my-2">
        <div
          role="checkbox"
          tabIndex={0}
          aria-checked={selected}
          aria-label={`Selecionar tarefa: ${task.title}`}
          onClick={() => onToggleSelect?.(task.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggleSelect?.(task.id);
            }
          }}
          className={cn(
            "relative cursor-pointer select-none rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-ring",
            selected && "ring-2 ring-primary",
          )}
        >
          <TaskCard task={task} membersById={membersById} clientName={clientName} />
          <span
            aria-hidden
            className={cn(
              "absolute right-2 top-2 flex size-5 items-center justify-center rounded-md border transition-colors",
              selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50 bg-card/90",
            )}
          >
            {selected && <Check className="size-3.5" />}
          </span>
        </div>
      </div>
    );
  }
  // No touch: segurar (delay do TouchSensor) levanta o card; swipe/scroll passa reto. touch-action
  // fica em "manipulation" (NUNCA "none", que mataria o scroll da coluna); select-none/touch-callout
  // evitam seleção de texto e menu de contexto no long-press. [painel]
  //
  // A11y: o wrapper NÃO recebe `attributes` (role=button/tabIndex do sortable) — quem é focável é o
  // próprio TaskCard (`asButton`), pra Enter/Espaço ABRIR a tarefa (o arrasto ficou só mouse/touch;
  // teclado não reordena, mas o status/coluna é editável na tela de detalhe). Sem KeyboardSensor, o
  // Enter no card não borbulha pra reiniciar drag. [painel a11y]
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: "manipulation",
        WebkitTouchCallout: "none",
      }}
      className={`scroll-my-2 select-none${isDragging ? " opacity-40" : ""}`}
      {...(dragDisabled ? {} : listeners)}
    >
      <TaskCard task={task} onOpen={onOpen} membersById={membersById} clientName={clientName} asButton />
    </div>
  );
}

interface Props {
  tasks: Task[];
  projectId: string;
  engagementId?: string; // quando presente, a move otimista/invalidação usa a lista do projeto [B2]
  membersById: Record<string, string>;
  dragDisabled?: boolean;
  onOpenTask: (id: string) => void;
  onAddTask: (status: TaskStatus, initialTitle?: string) => void;
  canCreate?: boolean; // esconde os controles de "+" quando falta tarefas_criar [criar-mais-rapido]
  // quick-add inline na coluna (só no board por-cliente, engagement conhecido). Ausente = "+" abre o modal.
  onQuickAdd?: (status: TaskStatus, title: string) => Promise<void>;
  // Visão GLOBAL: move próprio (otimista na lista agregada) + kicker de cliente no card. [tarefas-visao-global]
  onMove?: (vars: { id: string; status: TaskStatus; position: number }) => void;
  clientNameById?: Record<string, string>;
  showClient?: boolean;
  // Seleção múltipla (ações em massa). Props ausentes = board normal, sem seleção. [acoes-em-massa]
  selectMode?: boolean;
  isSelected?: (id: string) => boolean;
  onToggleSelect?: (id: string) => void;
  onToggleColumn?: (status: TaskStatus) => void; // "selecionar coluna" no header [RF-9]
}

export function KanbanBoard({
  tasks,
  projectId,
  engagementId,
  membersById,
  dragDisabled,
  onOpenTask,
  onAddTask,
  canCreate = true,
  onQuickAdd,
  onMove,
  clientNameById,
  showClient,
  selectMode,
  isSelected,
  onToggleSelect,
  onToggleColumn,
}: Props) {
  const move = useMoveTask(projectId, engagementId);
  const applyMove = onMove ?? move.mutate; // global injeta o próprio move; board usa o por-projeto
  const [activeId, setActiveId] = useState<string | null>(null);
  // Guarda contra "clique fantasma" pós-toque: depois de um drag o click sintético pode chamar
  // onOpen sem querer. Marcamos durante o drag e liberamos no tick seguinte. [painel]
  const draggedRef = useRef(false);

  // Mouse (desktop) e Touch (celular) separados: no toque, arrastar só após segurar ~220ms — swipe
  // rápido rola a coluna (passa da tolerância antes do delay) e toque simples abre. [painel / shell-mobile]
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  function openGuarded(id: string) {
    if (draggedRef.current) return; // veio de um drag, não abre
    onOpenTask(id);
  }

  const byColumn = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { TODO: [], DOING: [], DONE: [] };
    for (const t of tasks) map[t.status]?.push(t);
    for (const s of Object.keys(map) as TaskStatus[]) {
      map[s].sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1));
    }
    return map;
  }, [tasks]);

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  function handleDragStart(e: DragStartEvent) {
    draggedRef.current = true;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(12); // haptic (Android)
    setActiveId(String(e.active.id));
  }

  function releaseDragGuard() {
    // solta no próximo tick, depois do click sintético do toque ter passado
    setTimeout(() => {
      draggedRef.current = false;
    }, 0);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    releaseDragGuard();
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);
    const dragged = tasks.find((t) => t.id === active.id);
    if (!dragged || overId === dragged.id) return;

    let destStatus: TaskStatus;
    let overTaskId: string | null = null;
    if (overId.startsWith("col:")) {
      destStatus = overId.slice(4) as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask) return;
      destStatus = overTask.status;
      overTaskId = overTask.id;
    }

    const dest = byColumn[destStatus].filter((t) => t.id !== dragged.id);
    const index = overTaskId ? Math.max(0, dest.findIndex((t) => t.id === overTaskId)) : dest.length;
    const position = positionForIndex(
      dest.map((t) => t.position),
      index,
    );
    applyMove({ id: dragged.id, status: destStatus, position });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        releaseDragGuard();
      }}
    >
      <div className={cn("grid flex-1 grid-cols-1 gap-4 overflow-auto p-6 md:grid-cols-3", selectMode && "pb-28")}>
        {COLUMNS.map((col) => (
          <Column
            key={col.status}
            status={col.status}
            label={col.label}
            dot={col.dot}
            items={byColumn[col.status]}
            membersById={membersById}
            dragDisabled={dragDisabled}
            onOpenTask={openGuarded}
            onAddTask={onAddTask}
            canCreate={canCreate && !selectMode}
            onQuickAdd={onQuickAdd}
            clientNameById={clientNameById}
            showClient={showClient}
            selectMode={selectMode}
            isSelected={isSelected}
            onToggleSelect={onToggleSelect}
            onToggleColumn={onToggleColumn}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="scale-[1.02] rounded-xl shadow-md ring-1 ring-border">
            <TaskCard
              task={activeTask}
              membersById={membersById}
              clientName={showClient ? clientNameById?.[activeTask.projectId] : undefined}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  label,
  dot,
  items,
  membersById,
  dragDisabled,
  onOpenTask,
  onAddTask,
  canCreate = true,
  onQuickAdd,
  clientNameById,
  showClient,
  selectMode,
  isSelected,
  onToggleSelect,
  onToggleColumn,
}: {
  status: TaskStatus;
  label: string;
  dot: "todo" | "doing" | "done";
  items: Task[];
  membersById: Record<string, string>;
  dragDisabled?: boolean;
  onOpenTask: (id: string) => void;
  onAddTask: (status: TaskStatus, initialTitle?: string) => void;
  canCreate?: boolean;
  onQuickAdd?: (status: TaskStatus, title: string) => Promise<void>;
  clientNameById?: Record<string, string>;
  showClient?: boolean;
  selectMode?: boolean;
  isSelected?: (id: string) => boolean;
  onToggleSelect?: (id: string) => void;
  onToggleColumn?: (status: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });
  const colAllSelected = selectMode && items.length > 0 && items.every((t) => isSelected?.(t.id));
  const [composerOpen, setComposerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // quick-add inline só onde faz sentido: com onQuickAdd (board por-cliente) e fora do "Feito". [criar-mais-rapido]
  const supportsQuick = !!onQuickAdd && status !== "DONE";
  // gatilho "+": abre o composer inline (se suportado) ou o modal completo.
  const trigger = () => (supportsQuick ? setComposerOpen(true) : onAddTask(status));
  // fecha o composer e devolve o foco ao "+" (a11y — não deixa o foco cair no body). [review]
  const closeComposer = () => {
    setComposerOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <section aria-labelledby={`col-${status}`} className="flex min-w-0 flex-col">
      <div className="flex items-center gap-2.5 px-1 pb-3">
        <Dot kind={dot} />
        <span id={`col-${status}`} className="text-[13px] font-medium">
          {label}
        </span>
        <span className="rounded-full border border-border bg-card px-1.5 text-[11px] leading-[17px] text-muted-foreground">
          {items.length}
        </span>
        {selectMode && items.length > 0 && (
          <button
            type="button"
            role="checkbox"
            aria-checked={colAllSelected}
            aria-label={colAllSelected ? `Desmarcar coluna ${label}` : `Selecionar coluna ${label}`}
            onClick={() => onToggleColumn?.(status)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              aria-hidden
              className={cn(
                "flex size-4 items-center justify-center rounded border transition-colors",
                colAllSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50",
              )}
            >
              {colAllSelected && <Check className="size-3" />}
            </span>
            Coluna
          </button>
        )}
        {canCreate && (
          <button
            ref={triggerRef}
            type="button"
            aria-label={`Nova tarefa em ${label}`}
            onClick={trigger}
            className="ml-auto flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[80px] flex-col gap-2.5 rounded-xl transition-colors ${
          isOver ? "bg-card/50 outline outline-1 outline-dashed outline-border" : ""
        }`}
      >
        <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {items.map((t) => (
            <SortableCard
              key={t.id}
              task={t}
              onOpen={() => onOpenTask(t.id)}
              membersById={membersById}
              dragDisabled={dragDisabled}
              clientName={showClient ? clientNameById?.[t.projectId] : undefined}
              selectMode={selectMode}
              selected={isSelected?.(t.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </SortableContext>

        {/* composer inline no rodapé (tarefa nasce no fim, acima dele) */}
        {canCreate && supportsQuick && composerOpen && (
          <QuickAddInput
            placeholder="Título da tarefa"
            ariaLabel={`Título da nova tarefa em ${label}`}
            onSubmit={(title) => onQuickAdd!(status, title)}
            onExpand={(title) => {
              setComposerOpen(false);
              onAddTask(status, title);
            }}
            onClose={closeComposer}
          />
        )}

        {canCreate && items.length === 0 && !composerOpen && (
          <button
            type="button"
            onClick={trigger}
            className="flex items-center gap-1.5 px-1 py-2 text-xs text-muted-foreground/50 transition-colors hover:text-muted-foreground"
          >
            <Plus className="size-3.5" /> Adicionar tarefa
          </button>
        )}
      </div>
    </section>
  );
}
