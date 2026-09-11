"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check } from "lucide-react";
import type { Task } from "@/lib/types";
import { useMyTasks } from "@/lib/hooks/use-my-tasks";
import { generalEngagementId } from "@/lib/engagements";
import { dueState } from "@/lib/due";
import { notifKey, markSeen, pruneToTaskIds, useSeenNotifications } from "@/lib/notifications-store";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function NotificationsBell() {
  const router = useRouter();
  const mine = useMyTasks();
  const seen = useSeenNotifications();

  // Descarta "vistas" de tarefas que não existem mais (evita crescer sem fim).
  useEffect(() => {
    if (mine.data) pruneToTaskIds(new Set(mine.data.map((t) => t.id)));
  }, [mine.data]);

  const items = (mine.data ?? [])
    .map((t) => {
      const due = dueState(t.dueDate, t.status);
      return { task: t, due, key: notifKey(t.id, t.dueDate, due.state) };
    })
    .filter((x) => (x.due.state === "soon" || x.due.state === "overdue") && !seen.has(x.key))
    .sort((a, b) => {
      const rank = (s: string) => (s === "overdue" ? 0 : 1);
      return (
        rank(a.due.state) - rank(b.due.state) ||
        new Date(a.task.dueDate!).getTime() - new Date(b.task.dueDate!).getTime()
      );
    });

  const count = items.length;

  // Deep-link: navega DIRETO pro board do projeto da tarefa (id na URL, refresh-safe). [tarefas-visao-global RF-B2]
  function open(task: Task, key: string) {
    markSeen([key]);
    const eng = task.engagementId ?? generalEngagementId(task.projectId);
    router.push(`/clientes/${task.projectId}/projetos/${eng}?task=${task.id}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={count > 0 ? `${count} tarefas com prazo` : "Prazos"}
        className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="size-[18px]" strokeWidth={1.8} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-amber px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[300px]">
        <div className="flex items-center justify-between px-2.5 py-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Prazos</span>
          {count > 0 && (
            <button
              type="button"
              onClick={() => markSeen(items.map((x) => x.key))}
              className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Check className="size-3" />
              Marcar todas como vistas
            </button>
          )}
        </div>
        {count === 0 ? (
          <div className="px-2.5 py-3 text-[13px] text-muted-foreground">Nada vencendo por aqui.</div>
        ) : (
          items.map(({ task, due, key }) => (
            <DropdownMenuItem
              key={task.id}
              onSelect={() => open(task, key)}
              className="flex-col items-start gap-0.5"
            >
              <span className="line-clamp-1 text-[13px] text-foreground">{task.title}</span>
              <span className="text-[11.5px] text-amber">{due.label}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
