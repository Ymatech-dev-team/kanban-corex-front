"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, UserPlus } from "lucide-react";
import { useMyTasks } from "@/lib/hooks/use-my-tasks";
import { useMyNotifications, type AssignmentNotification } from "@/lib/hooks/use-notifications";
import { dueState } from "@/lib/due";
import { notifKey, markSeen, pruneToTaskIds, useSeenNotifications } from "@/lib/notifications-store";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

/** Chave estável do "visto" pra uma atribuição: taskId primeiro (o prune por-tarefa continua valendo). */
function assignKey(n: AssignmentNotification): string {
  return `${n.taskId}|assign|${n.id}`;
}

/** Tempo relativo curto em pt-BR ("agora", "há 2h", "ontem", "há 3 dias"). */
function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} dias`;
  const w = Math.floor(d / 7);
  if (w < 5) return `há ${w} sem`;
  const mo = Math.floor(d / 30);
  return `há ${mo} ${mo === 1 ? "mês" : "meses"}`;
}

export function NotificationsBell() {
  const router = useRouter();
  const mine = useMyTasks();
  const notifs = useMyNotifications();
  const seen = useSeenNotifications();

  // Atribuições ainda não vistas.
  const assigned = useMemo(
    () => (notifs.data ?? []).map((n) => ({ n, key: assignKey(n) })).filter((x) => !seen.has(x.key)),
    [notifs.data, seen],
  );

  // Prazos (soon/overdue) ainda não vistos — lógica original.
  const due = useMemo(
    () =>
      (mine.data ?? [])
        .map((t) => {
          const d = dueState(t.dueDate, t.status);
          return { task: t, due: d, key: notifKey(t.id, t.dueDate, d.state) };
        })
        .filter((x) => (x.due.state === "soon" || x.due.state === "overdue") && !seen.has(x.key))
        .sort((a, b) => {
          const rank = (s: string) => (s === "overdue" ? 0 : 1);
          return rank(a.due.state) - rank(b.due.state) || new Date(a.task.dueDate!).getTime() - new Date(b.task.dueDate!).getTime();
        }),
    [mine.data, seen],
  );

  // Poda "vistas" órfãs. SÓ quando AMBAS as fontes carregaram — senão, na corrida do mount, a união
  // ficaria parcial e apagaria "vistos" válidos (ex.: prazos reapareceriam). [lente code-review]
  useEffect(() => {
    if (!mine.data || !notifs.data) return;
    const ids = new Set<string>([...mine.data.map((t) => t.id), ...notifs.data.map((n) => n.taskId)]);
    pruneToTaskIds(ids);
  }, [mine.data, notifs.data]);

  const count = assigned.length + due.length;

  function openTask(taskId: string, key: string) {
    markSeen([key]);
    router.push(`/tarefas/${taskId}`);
  }

  function markAll() {
    markSeen([...assigned.map((x) => x.key), ...due.map((x) => x.key)]);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={count > 0 ? `${count} notificações` : "Notificações"}
        className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring max-lg:size-11"
      >
        <Bell className="size-[18px]" strokeWidth={1.8} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[320px]">
        <div className="px-2.5 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">Notificações</div>

        {count === 0 ? (
          <div className="px-2.5 py-3 text-[13px] text-muted-foreground">Nada por aqui.</div>
        ) : (
          <>
            {assigned.length > 0 && (
              <DropdownMenuGroup aria-label="Atribuídas a você">
                <DropdownMenuLabel aria-hidden>Atribuídas a você</DropdownMenuLabel>
                {assigned.map(({ n, key }) => (
                  <DropdownMenuItem key={key} onSelect={() => openTask(n.taskId, key)} className="items-start gap-2.5">
                    <span
                      aria-hidden
                      className="mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary"
                    >
                      <UserPlus className="size-3.5" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="line-clamp-1 text-[13px] text-foreground">{n.title}</span>
                      <span className="line-clamp-1 text-[12px] text-muted-foreground">
                        por {n.actorName} · {timeAgo(n.createdAt)}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            )}

            {due.length > 0 && (
              <>
                {assigned.length > 0 && <div className="my-1 border-t border-border" />}
                <DropdownMenuGroup aria-label="Prazos">
                  <DropdownMenuLabel aria-hidden>Prazos</DropdownMenuLabel>
                  {due.map(({ task, due: d, key }) => (
                    <DropdownMenuItem
                      key={task.id}
                      onSelect={() => openTask(task.id, key)}
                      className="flex-col items-start gap-0.5"
                    >
                      <span className="line-clamp-1 text-[13px] text-foreground">{task.title}</span>
                      <span className="text-[12px] text-primary">{d.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </>
            )}

            <div className="my-1 border-t border-border" />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault(); // mantém o menu aberto após marcar
                markAll();
              }}
              className="justify-center text-[11.5px] text-muted-foreground"
            >
              <Check className="size-3" aria-hidden />
              Marcar todas como vistas
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
