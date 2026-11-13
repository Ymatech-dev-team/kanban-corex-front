"use client";
import { Checkbox } from "@heroui/react";

import { Button } from "@/components/ui/button";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  pointerWithin,
  type DragOverEvent,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Plus } from "lucide-react";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@sistema-tasks/contracts";
import { useMoveTask } from "@/lib/hooks/use-tasks";
import { boardDrop } from "@/lib/board-drop";
import type { MoveVars } from "@/lib/hooks/use-tasks";
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
  if (kind === "done") return <span className="size-[9px] shrink-0 rounded-full bg-surface-secondary-foreground/70" />;
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
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: dragDisabled || selectMode, // no modo seleção o arrasto fica desligado [acoes-em-massa RF-1]
  });

  // Modo seleção: o card vira um toggle (clique/Enter/Espaço marca, nunca abre nem arrasta), com checkbox
  // menta no canto e realce menta na selecionada (distinto da barra-left âmbar de prazo). [RF-2/7]
  if (selectMode) {
    return (
      <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className="scroll-my-2">
        <Checkbox isSelected={!!selected} onChange={() => onToggleSelect?.(task.id)} aria-label={`Selecionar tarefa: ${task.title}`} className={cn("relative block w-full", selected && "rounded-xl ring-2 ring-primary")}><Checkbox.Content className="block w-full">
          <TaskCard task={task} membersById={membersById} clientName={clientName} />
          <Checkbox.Control className="absolute right-2 top-2"><Checkbox.Indicator /></Checkbox.Control>
        </Checkbox.Content></Checkbox>
      </div>
    );
  }
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("group relative scroll-my-2 select-none", isDragging && "opacity-20")}>
      <TaskCard task={task} onOpen={onOpen} membersById={membersById} clientName={clientName} asButton dragHandleSpace />
      {<Button variant="unstyled" disabled={dragDisabled} ref={setActivatorNodeRef} type="button" {...attributes} {...listeners}
        aria-label={`Mover tarefa: ${task.title}`} onClick={event => event.stopPropagation()}
        className="absolute right-2 top-2 flex size-8 touch-none items-center justify-center rounded-md bg-card text-muted-foreground shadow-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing cursor-grab disabled:cursor-default disabled:opacity-40">
        <GripVertical className="size-4" aria-hidden="true" />
      </Button>}
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
  onMove?: (vars: MoveVars) => Promise<unknown>;
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
  const applyMove = onMove ?? move.mutateAsync; // global injeta o próprio move; board usa o por-projeto
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragWidth, setDragWidth] = useState<number>();
  const [drop, setDrop] = useState<ReturnType<typeof boardDrop>>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const sourceRef = useRef<Task | null>(null);
  // Guarda contra "clique fantasma" pós-toque: depois de um drag o click sintético pode chamar
  // onOpen sem querer. Marcamos durante o drag e liberamos no tick seguinte. [painel]
  const draggedRef = useRef(false);

  // Mouse (desktop) e Touch (celular) separados: no toque, arrastar só após segurar ~220ms — swipe
  // rápido rola a coluna (passa da tolerância antes do delay) e toque simples abre. [painel / shell-mobile]
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
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
    if (savingRef.current) return;
    sourceRef.current = tasks.find(task => task.id === String(e.active.id)) ?? null;
    setDragWidth(e.active.rect.current.initial?.width);
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

  function resolveDrop(e: DragOverEvent | DragEndEvent) {
    if (!e.over) return null;
    const translated = e.active.rect.current.translated;
    const source = tasks.find(task => task.id === String(e.active.id));
    const target = tasks.find(task => task.id === String(e.over?.id));
    const after = e.activatorEvent.type === "keydown" && source && target && source.status === target.status
      ? byColumn[source.status].indexOf(target) > byColumn[source.status].indexOf(source)
      : !!translated && translated.top + translated.height / 2 > e.over.rect.top + e.over.rect.height / 2;
    return boardDrop(tasks, String(e.active.id), String(e.over.id), after);
  }
  async function handleDragEnd(e: DragEndEvent) {
    const destination = resolveDrop(e);
    const dragged = sourceRef.current;
    setActiveId(null); setDrop(null); releaseDragGuard();
    if (!destination || !dragged || savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      await applyMove({ id: dragged.id, status: destination.status, position: destination.position, updatedAt: dragged.updatedAt, operationId: crypto.randomUUID() });
    } catch { /* Hook restores the card and presents a useful error. */ }
    finally { savingRef.current = false; setSaving(false); }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={args => { const hits = pointerWithin(args); return hits.length ? hits.filter(hit => !String(hit.id).startsWith("col:")).length ? hits.filter(hit => !String(hit.id).startsWith("col:")) : hits : args.pointerCoordinates ? [] : closestCorners(args); }}
      onDragOver={event => setDrop(resolveDrop(event))}
      onDragMove={event => setDrop(resolveDrop(event))}
      accessibility={{ screenReaderInstructions: { draggable: "Pressione espaço para mover. Use as setas para escolher a posição, espaço para soltar e Escape para cancelar." } }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null); setDrop(null);
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
            dragDisabled={dragDisabled || saving}
            insertion={drop?.status === col.status ? drop.beforeId : undefined}
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
      {saving && <p role="status" className="sr-only">Salvando posição da tarefa</p>}
      {typeof document !== "undefined" && createPortal(<DragOverlay adjustScale={false} dropAnimation={null} zIndex={100}>
        {activeTask ? (
          <div style={{ width: dragWidth }} className="pointer-events-none rounded-xl shadow-xl">
            <TaskCard
              task={activeTask}
              dragHandleSpace
              membersById={membersById}
              clientName={showClient ? clientNameById?.[activeTask.projectId] : undefined}
            />
          </div>
        ) : null}
      </DragOverlay>, document.body)}
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
  insertion,
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
  insertion?: string | null;
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
    <section ref={setNodeRef} aria-labelledby={`col-${status}`} className="flex min-h-64 min-w-0 flex-col">
      <div className="flex items-center gap-2.5 px-1 pb-3">
        <Dot kind={dot} />
        <span id={`col-${status}`} className="text-[13px] font-medium">
          {label}
        </span>
        <span className="rounded-full border border-border bg-card px-1.5 text-[11px] leading-[17px] text-muted-foreground">
          {items.length}
        </span>
        {selectMode && items.length > 0 && (
          <Button variant="unstyled"
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
          </Button>
        )}
        {canCreate && (
          <Button variant="unstyled"
            ref={triggerRef}
            type="button"
            aria-label={`Nova tarefa em ${label}`}
            onClick={trigger}
            className="ml-auto flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-4" />
          </Button>
        )}
      </div>
      <div
        className={`flex min-h-[80px] flex-1 flex-col gap-2.5 rounded-xl transition-colors ${
          isOver ? "bg-card/50 outline outline-1 outline-dashed outline-border" : ""
        }`}
      >
        <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {items.map((t) => (
            <div key={t.id} className="relative">
            {insertion === t.id && <div aria-hidden="true" className="pointer-events-none absolute -top-1.5 inset-x-0 h-0.5 rounded-full bg-primary" />}
            <SortableCard
              task={t}
              onOpen={() => onOpenTask(t.id)}
              membersById={membersById}
              dragDisabled={dragDisabled}
              clientName={showClient ? clientNameById?.[t.projectId] : undefined}
              selectMode={selectMode}
              selected={isSelected?.(t.id)}
              onToggleSelect={onToggleSelect}
            /></div>
          ))}
        </SortableContext>
        {insertion === null && <div aria-hidden="true" className="pointer-events-none h-0.5 rounded-full bg-primary" />}

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
          <Button variant="unstyled"
            type="button"
            onClick={trigger}
            className="flex items-center gap-1.5 px-1 py-2 text-xs text-muted-foreground/50 transition-colors hover:text-muted-foreground"
          >
            <Plus className="size-3.5" /> Adicionar tarefa
          </Button>
        )}
      </div>
    </section>
  );
}
