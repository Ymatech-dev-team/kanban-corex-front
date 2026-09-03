import { User } from "lucide-react";
import type { Task } from "@/lib/types";
import type { TaskPriority } from "@sistema-tasks/contracts";
import { initials } from "@/lib/initials";
import { dueState } from "@/lib/due";
import { cn } from "@/lib/utils";

const BARS: Record<TaskPriority, number[]> = { LOW: [4, 4, 4], MEDIUM: [4, 8, 8], HIGH: [4, 8, 12] };
const PRIO_LABEL: Record<TaskPriority, string> = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta" };

export function TaskCard({
  task,
  onOpen,
  assigneeName,
}: {
  task: Task;
  onOpen?: () => void;
  assigneeName?: string | null;
}) {
  const done = task.status === "DONE";
  const due = dueState(task.dueDate, task.status);
  const attention = due.state === "soon" || due.state === "overdue";
  const bars = BARS[task.priority];
  const subs = task.subtasks ?? [];
  const subDone = subs.filter((s) => s.done).length;

  return (
    <article
      onClick={onOpen}
      className={cn(
        "rounded-xl border border-border bg-card p-3 transition-colors hover:border-muted-foreground/40",
        onOpen && "cursor-pointer",
        attention && "rounded-l-none border-l-[3px] border-l-amber",
      )}
    >
      <div className={cn("mb-2.5 text-[13.5px] leading-snug", done && "text-muted-foreground line-through")}>
        {task.title}
      </div>
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 text-[11.5px] text-muted-foreground">
          {!done && (
            <span className="inline-flex h-3 items-end gap-[2px]" aria-label={`Prioridade ${PRIO_LABEL[task.priority]}`}>
              {bars.map((h, i) => (
                <i
                  key={i}
                  className={cn("block w-[3px] rounded-sm bg-muted-foreground", task.priority === "HIGH" && "bg-amber")}
                  style={{ height: h }}
                />
              ))}
            </span>
          )}
          {!done && <span>{PRIO_LABEL[task.priority]}</span>}
          {due.label && <span className={cn(attention && "text-amber")}>{due.label}</span>}
          {subs.length > 0 && (
            <span>
              {subDone}/{subs.length}
            </span>
          )}
        </div>
        {task.assigneeId ? (
          <span
            title={assigneeName ?? undefined}
            className="flex size-[22px] items-center justify-center rounded-full border border-muted-foreground/40 bg-accent text-[10px] font-medium text-foreground"
          >
            {assigneeName ? initials(assigneeName) : <User className="size-3 text-muted-foreground" />}
          </span>
        ) : (
          <span className="flex size-[22px] items-center justify-center rounded-full border border-dashed border-muted-foreground/50 text-[13px] text-muted-foreground/60">
            +
          </span>
        )}
      </div>
      {subs.length > 0 && !done && (
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-border">
          <i className="block h-full bg-muted-foreground" style={{ width: `${(subDone / subs.length) * 100}%` }} />
        </div>
      )}
    </article>
  );
}
