import { User } from "lucide-react";
import type { Task } from "@/lib/types";
import type { TaskPriority } from "@sistema-tasks/contracts";
import { initials } from "@/lib/initials";
import { dueTag, isDueUrgent } from "@/lib/due";
import { cn } from "@/lib/utils";

const BARS: Record<TaskPriority, number[]> = { LOW: [4, 4, 4], MEDIUM: [4, 8, 8], HIGH: [4, 8, 12] };
const PRIO_LABEL: Record<TaskPriority, string> = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta" };

/** ids dos responsáveis (principal primeiro, depois extras), sem duplicar. */
function assigneeIdsOf(task: Task): string[] {
  const ids = task.assigneeId ? [task.assigneeId] : [];
  for (const id of task.extraAssigneeIds ?? []) if (!ids.includes(id)) ids.push(id);
  return ids;
}

function AvatarStack({ ids, membersById }: { ids: string[]; membersById: Record<string, string> }) {
  if (ids.length === 0) {
    return (
      <span className="flex size-[22px] items-center justify-center rounded-full border border-dashed border-muted-foreground/50 text-[13px] text-muted-foreground/60">
        +
      </span>
    );
  }
  const shown = ids.slice(0, 3);
  const extra = ids.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((id, i) => {
        const name = membersById[id];
        return (
          <span
            key={id}
            title={name ?? "Sem acesso ao cliente"}
            className={cn(
              "flex size-[22px] items-center justify-center rounded-full border border-background bg-accent text-[10px] font-medium text-foreground ring-1 ring-muted-foreground/30",
              i > 0 && "-ml-2",
            )}
          >
            {name ? initials(name) : <User className="size-3 text-muted-foreground" />}
          </span>
        );
      })}
      {extra > 0 && (
        <span className="-ml-2 flex size-[22px] items-center justify-center rounded-full border border-background bg-card text-[10px] font-medium text-muted-foreground ring-1 ring-muted-foreground/30">
          +{extra}
        </span>
      )}
    </span>
  );
}

export function TaskCard({
  task,
  onOpen,
  membersById,
  clientName,
}: {
  task: Task;
  onOpen?: () => void;
  membersById: Record<string, string>;
  clientName?: string; // "kicker" de cliente no topo — só na visão global que cruza clientes [tarefas-visao-global]
}) {
  const done = task.status === "DONE";
  const due = dueTag(task.dueDate, task.status);
  const urgent = isDueUrgent(due.state); // âmbar só em vencida+hoje [cor contida]
  const bars = BARS[task.priority];
  const subs = task.subtasks ?? [];
  const subDone = subs.filter((s) => s.done).length;

  return (
    <article
      onClick={onOpen}
      className={cn(
        "rounded-xl border border-border bg-card p-3 transition-colors hover:border-muted-foreground/40",
        onOpen && "cursor-pointer",
        urgent && "rounded-l-none border-l-[3px] border-l-amber",
      )}
    >
      {clientName && (
        <div className="mb-1 truncate text-[11px] text-muted-foreground" title={clientName}>
          {clientName}
        </div>
      )}
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
                  className={cn("block w-[3px] rounded-sm bg-muted-foreground", task.priority === "HIGH" && "bg-foreground")}
                  style={{ height: h }}
                />
              ))}
            </span>
          )}
          {!done && <span>{PRIO_LABEL[task.priority]}</span>}
          {due.label &&
            (urgent ? (
              // Tag de prazo urgente: dot âmbar + label neutro (vencida ganha peso, não cor nova). [cor contida]
              <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                <span className="size-1.5 shrink-0 rounded-full bg-amber" aria-hidden />
                <span className={cn(due.state === "overdue" && "font-medium text-foreground")}>{due.label}</span>
              </span>
            ) : (
              <span className="shrink-0 whitespace-nowrap">{due.label}</span>
            ))}
          {subs.length > 0 && (
            <span>
              {subDone}/{subs.length}
            </span>
          )}
        </div>
        <AvatarStack ids={assigneeIdsOf(task)} membersById={membersById} />
      </div>
      {subs.length > 0 && !done && (
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-border">
          <i className="block h-full bg-muted-foreground" style={{ width: `${(subDone / subs.length) * 100}%` }} />
        </div>
      )}
    </article>
  );
}
