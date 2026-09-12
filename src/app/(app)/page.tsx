"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, CalendarDays, CircleDashed, ChevronRight, Loader2, ListTodo } from "lucide-react";
import type { Task } from "@/lib/types";
import { useMyTasks } from "@/lib/hooks/use-my-tasks";
import { useProjects } from "@/lib/hooks/use-projects";
import { useMe } from "@/lib/hooks/use-me";
import { generalEngagementId } from "@/lib/engagements";
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
  const mine = useMyTasks();
  const projects = useProjects();
  const me = useMe();

  const projectsById = useMemo(
    () => Object.fromEntries((projects.data ?? []).map((p) => [p.id, p.name])),
    [projects.data],
  );

  // snapshot no mount — evita recomputo por render e deixa os useMemo estáveis. [rev-fase4]
  const [now] = useState(() => Date.now());
  const week = useMemo(() => weekDaysMonday(new Date(now)), [now]);
  const weekEnd = startOfDay(week[6].getTime());
  const todayKey = dayKey(new Date(now));

  const all = mine.data ?? [];
  const open = all.filter((t) => t.status !== "DONE");
  const overdue = open.filter((t) => t.dueDate && dayDiff(t.dueDate, now) < 0);
  const today = open.filter((t) => t.dueDate && dayDiff(t.dueDate, now) === 0);
  const upcoming = open.filter(
    (t) => t.dueDate && dayDiff(t.dueDate, now) > 0 && startOfDay(new Date(t.dueDate).getTime()) <= weekEnd,
  );
  const noDue = open.filter((t) => !t.dueDate);
  const doing = open.filter((t) => t.status === "DOING");

  const focus = [...overdue.sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)), ...today];
  const nextUp = focus.length === 0 ? nextTasks(open) : [];

  // conclusão (só quando há tarefas): DONE / total das minhas tarefas
  const doneCount = all.filter((t) => t.status === "DONE").length;
  const donePct = all.length > 0 ? Math.round((doneCount / all.length) * 100) : 0;
  const todoCount = open.filter((t) => t.status === "TODO").length;

  // barras: nº de tarefas abertas com prazo em cada dia da semana atual
  const byDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of open) {
      if (!t.dueDate) continue;
      const k = dayKey(new Date(t.dueDate));
      map[k] = (map[k] ?? 0) + 1;
    }
    return map;
  }, [open]);
  const weekCounts = week.map((d) => byDay[dayKey(d)] ?? 0);
  const weekMax = Math.max(1, ...weekCounts);
  const weekHasAny = weekCounts.some((c) => c > 0);

  const perClient = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of open) counts[t.projectId] = (counts[t.projectId] ?? 0) + 1;
    return Object.entries(counts)
      .map(([id, count]) => ({ id, name: projectsById[id] ?? "Cliente", count }))
      .sort((a, b) => b.count - a.count);
  }, [open, projectsById]);

  function openTask(t: Task) {
    const eng = t.engagementId ?? generalEngagementId(t.projectId);
    router.push(`/clientes/${t.projectId}/projetos/${eng}?task=${t.id}`);
  }
  function openClient(projectId: string) {
    router.push(`/clientes/${projectId}/projetos/${generalEngagementId(projectId)}`);
  }

  const firstName = me.data?.name?.trim().split(/\s+/)[0];

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-8">
        <header>
          <h1 className="text-xl font-medium tracking-tight">Olá{firstName ? `, ${firstName}` : ""}!</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {rangeFmt.format(week[0])} – {rangeFmt.format(week[6])}
          </p>
        </header>

        {mine.isLoading ? (
          <DashboardSkeleton />
        ) : mine.isError ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertTriangle className="size-6 text-amber" />
            <p className="text-sm text-muted-foreground">Não foi possível carregar suas tarefas.</p>
            <Button variant="secondary" onClick={() => mine.refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : all.length === 0 ? (
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
            {/* Linha 1 — Resumo · Semana · Conclusão */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1.25fr_1fr]">
              <Card title="Resumo">
                <div className="grid grid-cols-2 gap-2.5">
                  <Tile value={overdue.length} label="Vencidas" amber={overdue.length > 0} />
                  <Tile value={today.length} label="Vence hoje" amber={today.length > 0} />
                  <Tile value={upcoming.length} label="Esta semana" />
                  <Tile value={noDue.length} label="Sem prazo" />
                </div>
              </Card>

              <Card title="Tarefas na semana" hint="por dia">
                {weekHasAny ? (
                  <div className="flex h-[112px] items-end gap-2.5 pt-1.5">
                    {week.map((d, i) => {
                      const c = weekCounts[i];
                      const isToday = dayKey(d) === todayKey;
                      return (
                        <div
                          key={dayKey(d)}
                          role="img"
                          aria-label={`${WEEKDAY[i]}: ${c} ${c === 1 ? "tarefa" : "tarefas"}`}
                          className="flex h-full flex-1 flex-col items-center gap-1.5"
                        >
                          <div className="mt-auto flex w-full items-end justify-center">
                            <div
                              className={cn("w-full rounded-t-md", isToday ? "bg-primary" : "bg-muted-foreground/25")}
                              style={{ height: `${Math.max(c > 0 ? 8 : 0, (c / weekMax) * 92)}px` }}
                              aria-hidden
                            />
                          </div>
                          <span className={cn("text-[10.5px]", isToday ? "text-primary" : "text-muted-foreground")}>
                            {WEEKDAY[i]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-[112px] items-center justify-center text-[12.5px] text-muted-foreground">
                    Nada com prazo nesta semana.
                  </div>
                )}
              </Card>

              <Card title="Conclusão">
                <div className="flex items-center gap-4">
                  <Donut pct={donePct} />
                  <div className="flex flex-col gap-2 text-[12px] text-muted-foreground">
                    <Legend color="var(--primary)" label="Feito" n={doneCount} />
                    <Legend color="var(--muted-foreground)" label="Fazendo" n={doing.length} />
                    <Legend color="color-mix(in oklab, var(--muted-foreground) 45%, transparent)" label="A fazer" n={todoCount} />
                  </div>
                </div>
              </Card>
            </div>

            {/* Linha 2 — Foco de hoje (herói) · Em andamento */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.9fr_1fr]">
              <Card title="Foco de hoje" hint={focus.length > 0 ? "vencidas + hoje" : undefined}>
                {focus.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {focus.map((t) => {
                      const due = dueState(t.dueDate, t.status, now);
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => openTask(t)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg border border-border bg-background px-3.5 py-2.5 text-left transition-colors hover:border-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              due.state === "overdue" && "rounded-l-none border-l-[3px] border-l-amber",
                            )}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-1 text-[13.5px]">{t.title}</span>
                              <span className="text-[11.5px] text-muted-foreground">{projectsById[t.projectId] ?? "Cliente"}</span>
                            </span>
                            <span className="shrink-0 text-[11.5px] text-amber">{due.label}</span>
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <>
                    <p className="mb-2 text-[12.5px] text-muted-foreground">Nada urgente pra hoje — comece por:</p>
                    <ul className="flex flex-col gap-2">
                      {nextUp.map((t) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => openTask(t)}
                            className="flex w-full items-center gap-3 rounded-lg border border-border bg-background px-3.5 py-2.5 text-left transition-colors hover:border-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Card>

              <Card title={`Em andamento${doing.length ? ` (${doing.length})` : ""}`}>
                {doing.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {doing.slice(0, 5).map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => openTask(t)}
                          className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-left transition-colors hover:border-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="line-clamp-1 text-[13px]">{t.title}</span>
                          <span className="mt-1 block text-[11px] text-muted-foreground">
                            {projectsById[t.projectId] ?? "Cliente"} · {PRIORITY_LABEL[t.priority] ?? "—"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-6 text-center text-[12.5px] text-muted-foreground">Nada em andamento.</p>
                )}
              </Card>
            </div>

            {/* Seus clientes */}
            {perClient.length > 0 && (
              <Card title="Seus clientes">
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {perClient.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => openClient(c.id)}
                      className="flex items-center gap-3 rounded-lg border border-border bg-background px-3.5 py-2.5 text-left transition-colors hover:border-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px]">{c.name}</span>
                      <span className="shrink-0 text-[11.5px] text-muted-foreground">
                        {c.count} {c.count === 1 ? "tarefa" : "tarefas"}
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-medium tracking-tight">{title}</h2>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Tile({ value, label, amber }: { value: number; label: string; amber?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background px-3 py-2.5",
        amber && "rounded-l-none border-l-[2px] border-l-amber",
      )}
    >
      <div className={cn("text-2xl font-semibold leading-none tracking-tight", amber && "text-amber")}>{value}</div>
      <div className="mt-1.5 text-[11.5px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Donut({ pct }: { pct: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <div className="relative size-[104px] shrink-0">
      <svg width="104" height="104" viewBox="0 0 104 104" role="img" aria-label={`${pct}% concluído`}>
        <title>{`${pct}% concluído`}</title>
        <circle cx="52" cy="52" r={r} fill="none" strokeWidth="10" style={{ stroke: "var(--border)" }} />
        {pct > 0 && (
          <circle
            cx="52"
            cy="52"
            r={r}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            transform="rotate(-90 52 52)"
            style={{ stroke: "var(--primary)" }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tracking-tight">{pct}%</span>
        <span className="text-[10.5px] text-muted-foreground">concluído</span>
      </div>
    </div>
  );
}

function Legend({ color, label, n }: { color: string; label: string; n: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      <span>
        {label} · {n}
      </span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[168px] animate-pulse rounded-2xl border border-border bg-card" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.9fr_1fr]">
        <div className="h-[240px] animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-[240px] animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    </div>
  );
}
