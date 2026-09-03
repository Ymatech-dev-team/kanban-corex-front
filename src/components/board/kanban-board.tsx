"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import type { Task } from "@/lib/types";
import type { TaskStatus } from "@sistema-tasks/contracts";
import { useMoveTask } from "@/lib/hooks/use-tasks";
import { positionForIndex } from "@/lib/position";
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
  assigneeName,
  dragDisabled,
}: {
  task: Task;
  onOpen: () => void;
  assigneeName?: string | null;
  dragDisabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: dragDisabled,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-40" : undefined}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} onOpen={onOpen} assigneeName={assigneeName} />
    </div>
  );
}

interface Props {
  tasks: Task[];
  projectId: string;
  membersById: Record<string, string>;
  dragDisabled?: boolean;
  onOpenTask: (id: string) => void;
  onAddTask: (status: TaskStatus) => void;
}

export function KanbanBoard({ tasks, projectId, membersById, dragDisabled, onOpenTask, onAddTask }: Props) {
  const move = useMoveTask(projectId);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
    setActiveId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
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
    move.mutate({ id: dragged.id, status: destStatus, position });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid flex-1 grid-cols-1 gap-4 overflow-auto p-6 md:grid-cols-3">
        {COLUMNS.map((col) => (
          <Column
            key={col.status}
            status={col.status}
            label={col.label}
            dot={col.dot}
            items={byColumn[col.status]}
            membersById={membersById}
            dragDisabled={dragDisabled}
            onOpenTask={onOpenTask}
            onAddTask={onAddTask}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <TaskCard task={activeTask} assigneeName={activeTask.assigneeId ? membersById[activeTask.assigneeId] : null} />
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
}: {
  status: TaskStatus;
  label: string;
  dot: "todo" | "doing" | "done";
  items: Task[];
  membersById: Record<string, string>;
  dragDisabled?: boolean;
  onOpenTask: (id: string) => void;
  onAddTask: (status: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });
  return (
    <section className="flex min-w-0 flex-col">
      <div className="flex items-center gap-2.5 px-1 pb-3">
        <Dot kind={dot} />
        <span className="text-[13px] font-medium">{label}</span>
        <span className="rounded-full border border-border bg-card px-1.5 text-[11px] leading-[17px] text-muted-foreground">
          {items.length}
        </span>
        <button
          type="button"
          aria-label={`Nova tarefa em ${label}`}
          onClick={() => onAddTask(status)}
          className="ml-auto flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
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
              assigneeName={t.assigneeId ? membersById[t.assigneeId] : null}
              dragDisabled={dragDisabled}
            />
          ))}
        </SortableContext>
        {items.length === 0 && (
          <button
            type="button"
            onClick={() => onAddTask(status)}
            className="flex items-center gap-1.5 px-1 py-2 text-xs text-muted-foreground/50 transition-colors hover:text-muted-foreground"
          >
            <Plus className="size-3.5" /> Adicionar tarefa
          </button>
        )}
      </div>
    </section>
  );
}
