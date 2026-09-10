"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, CalendarDays, CircleDashed, ChevronRight, Loader2, ListTodo } from "lucide-react";
import type { Task } from "@/lib/types";
import { useMyTasks } from "@/lib/hooks/use-my-tasks";
import { useProjects } from "@/lib/hooks/use-projects";
import { useBoardNav } from "@/lib/board-nav";
import { dueState } from "@/lib/due";
import { nextTasks, PRIORITY_LABEL } from "@/lib/focus";
import { weekDaysMonday } from "@/lib/week";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DAY = 86_400_000;
function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function dayDiff(dueISO: string, now: number): number {
  return Math.round((startOfDay(new Date(dueISO).getTime()) - startOfDay(now)) / DAY);
}
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const WEEKDAY = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const rangeFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });

export default function HomePage() {
  const router = useRouter();
  const nav = useBoardNav();
  const mine = useMyTasks();
  const projects = useProjects();

  const projectsById = useMemo(
    () => Object.fromEntries((projects.data ?? []).map((p) => [p.id, p.name])),
    [projects.data],
  );

  const now = Date.now();
  const week = useMemo(() => weekDaysMonday(new Date(now)), [now]);
  const weekEnd = startOfDay(week[6].getTime());

  const open = (mine.data ?? []).filter((t) => t.status !== "DONE");
  const overdue = open.filter((t) => t.dueDate && dayDiff(t.dueDate, now) < 0);
  const today = open.filter((t) => t.dueDate && dayDiff(t.dueDate, now) === 0);
  const upcoming = open.filter(
    (t) => t.dueDate && dayDiff(t.dueDate, now) > 0 && startOfDay(new Date(t.dueDate).getTime()) <= weekEnd,
  );
  const noDue = open.filter((t) => !t.dueDate);

  const focus = [...overdue.sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)), ...today];

  // Sem nada urgente hoje → sugere as 3 próximas a atacar (fallback do Foco de hoje). [foco-proxima-tarefa]
  const nextUp = focus.length === 0 ? nextTasks(open) : [];

  const byDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of open) {
      if (!t.dueDate) continue;
      (map[dayKey(new Date(t.dueDate))] ??= []).push(t);
    }
    return map;
  }, [open]);

  const perClient = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of open) counts[t.projectId] = (counts[t.projectId] ?? 0) + 1;
    return Object.entries(counts)
      .map(([id, count]) => ({ id, name: projectsById[id] ?? "Cliente", count }))
      .sort((a, b) => b.count - a.count);
  }, [open, projectsById]);

  function openTask(t: Task) {
    nav.request(t.projectId, t.id);
    router.push("/tarefas");
  }
  function openClient(projectId: string) {
    nav.request(projectId);
    router.push("/tarefas");
  }

  const todayKey = dayKey(new Date(now));

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8">
        <header>
          <h1 className="text-xl font-medium tracking-tight">Sua semana</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {rangeFmt.format(week[0])} – {rangeFmt.format(week[6])}
          </p>
        </header>

        {mine.isLoading ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : mine.isError ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertTriangle className="size-6 text-amber" />
            <p className="text-sm text-muted-foreground">Não foi possível carregar suas tarefas.</p>
            <Button variant="secondary" onClick={() => mine.refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : open.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
              <ListTodo className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-medium tracking-tight">Nada atribuído a você por enquanto</h2>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Quando você for responsável por tarefas, elas aparecem aqui.
              </p>
            </div>
            <Button onClick={() => router.push("/tarefas")}>Ir para as tarefas</Button>
          </div>
        ) : (
          <>
            {/* Cartões de número */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat icon={AlertTriangle} label="Vencidas" value={overdue.length} amber={overdue.length > 0} />
              <Stat icon={CalendarClock} label="Vence hoje" value={today.length} amber={today.length > 0} />
              <Stat icon={CalendarDays} label="Ainda esta semana" value={upcoming.length} />
              <Stat icon={CircleDashed} label="Sem prazo" value={noDue.length} />
            </div>

            {/* Foco de hoje */}
            <section className="flex flex-col gap-2">
              <h2 className="text-[13px] font-medium tracking-tight">Foco de hoje</h2>
              {focus.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {focus.map((t) => {
                    const due = dueState(t.dueDate, t.status, now);
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => openTask(t)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-muted-foreground/40",
                            due.state === "overdue" && "rounded-l-none border-l-[3px] border-l-amber",
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-1 text-[13.5px]">{t.title}</span>
                            <span className="text-[11.5px] text-muted-foreground">{projectsById[t.projectId]}</span>
                          </span>
                          <span className="shrink-0 text-[11.5px] text-amber">{due.label}</span>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <>
                  {/* Fallback neutro (sem âmbar — âmbar é urgência). Com open>0 e focus vazio, nextUp tem ≥1. [foco-proxima-tarefa] */}
                  <p className="text-[13px] text-muted-foreground">Nada urgente pra hoje — comece por:</p>
                  <ul className="flex flex-col gap-1.5">
                    {nextUp.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => openTask(t)}
                          className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-muted-foreground/40"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-1 text-[13.5px]">{t.title}</span>
                            <span className="text-[11.5px] text-muted-foreground">
                              {projectsById[t.projectId] ?? "Cliente"} · {PRIORITY_LABEL[t.priority] ?? "—"}
                            </span>
                          </span>
                          <span className="shrink-0 text-[11.5px] text-muted-foreground">
                            {t.dueDate ? dueState(t.dueDate, t.status, now).label : "sem prazo"}
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            {/* Agenda da semana */}
            <section className="flex flex-col gap-2">
              <h2 className="text-[13px] font-medium tracking-tight">Agenda da semana</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
                {week.map((day, i) => {
                  const key = dayKey(day);
                  const isToday = key === todayKey;
                  const dayTasks = byDay[key] ?? [];
                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex min-h-[96px] flex-col gap-1 rounded-xl border border-border bg-card p-2",
                        isToday && "border-muted-foreground/40",
                      )}
                    >
                      <div className="mb-0.5 flex items-baseline justify-between px-0.5">
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">{WEEKDAY[i]}</span>
                        <span className={cn("text-[12px]", isToday ? "font-medium text-foreground" : "text-muted-foreground")}>
                          {day.getDate()}
                        </span>
                      </div>
                      {dayTasks.slice(0, 3).map((t) => {
                        const overdueChip = t.dueDate && dayDiff(t.dueDate, now) < 0;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => openTask(t)}
                            title={t.title}
                            className={cn(
                              "truncate rounded-md border border-border bg-card px-1.5 py-1 text-left text-[11.5px] transition-colors hover:border-muted-foreground/40",
                              overdueChip && "border-l-[3px] border-l-amber",
                            )}
                          >
                            {t.title}
                          </button>
                        );
                      })}
                      {dayTasks.length > 3 && (
                        <span className="px-1 text-[11px] text-muted-foreground/60">+{dayTasks.length - 3}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Por cliente */}
            {perClient.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-[13px] font-medium tracking-tight">Por cliente</h2>
                <ul className="flex flex-col gap-1">
                  {perClient.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => openClient(c.id)}
                        className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-left text-[13px] transition-colors hover:border-muted-foreground/40"
                      >
                        <span className="flex-1">{c.name}</span>
                        <span className="text-muted-foreground">
                          {c.count} {c.count === 1 ? "tarefa" : "tarefas"}
                        </span>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  amber,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  amber?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <Icon className={cn("size-4", amber ? "text-amber" : "text-muted-foreground")} strokeWidth={1.8} />
      <div>
        <div className={cn("text-2xl font-medium tracking-tight", amber && "text-amber")}>{value}</div>
        <div className="text-[12px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
