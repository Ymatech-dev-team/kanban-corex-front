"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Task } from "@/lib/types";
import { agendaDaysForMonth, buildMonthMatrix, dayKey, groupTasksByDay } from "@/lib/calendar";
import { TaskCard } from "@/components/board/task-card";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const dayLongFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });
const weekdayFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });

function isSameMonth(d: Date, cursor: Date) {
  return d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear();
}

function firstOfThisMonth() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1);
}

export function TaskCalendar({
  tasks,
  onOpenTask,
  membersById = {},
}: {
  tasks: Task[];
  onOpenTask: (id: string) => void;
  membersById?: Record<string, string>;
}) {
  const [cursor, setCursor] = useState(firstOfThisMonth);

  const weeks = useMemo(() => buildMonthMatrix(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const byDay = useMemo(() => groupTasksByDay(tasks), [tasks]);
  const agenda = useMemo(() => agendaDaysForMonth(byDay, cursor), [byDay, cursor]);
  const noDue = useMemo(() => tasks.filter((t) => !t.dueDate), [tasks]);
  const todayKey = dayKey(new Date());
  const now = Date.now();

  const cursorIsCurrentMonth = isSameMonth(new Date(), cursor);
  const title = monthFmt.format(cursor);

  function goToMonth(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  // Agenda: ao ABRIR/TROCAR pro mês corrente, rola até o dia de hoje (âncora temporal). Só depende do
  // `cursor` — não do conteúdo — senão re-ancoraria a cada refetch/toggle de tarefa e engoliria o scroll
  // do usuário. `block:"nearest"` mantém o efeito contido ao container da agenda, não à página. [jornada]
  const agendaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isSameMonth(new Date(), cursor)) return;
    const el = agendaRef.current?.querySelector<HTMLElement>('[data-today="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header do mês — renderizado UMA vez; só o corpo muda por breakpoint. */}
      <div className="flex items-center gap-2 px-4 pt-4 lg:px-6 lg:pt-6">
        <h2 aria-live="polite" className="text-[15px] font-medium capitalize tracking-tight">
          {title}
        </h2>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => goToMonth(-1)}
            className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground lg:size-7"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => goToMonth(1)}
            className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground lg:size-7"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setCursor(firstOfThisMonth())}
          className="flex h-10 items-center rounded-md border border-border bg-card px-3 text-[12px] text-muted-foreground transition-colors hover:text-foreground lg:h-auto lg:px-2.5 lg:py-1"
        >
          Hoje
        </button>
      </div>

      {/* ===== Desktop: grade do mês (inalterada) ===== */}
      <div className="hidden min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6 pt-3 lg:flex">
        <div className="grid grid-cols-7 border-b border-border pb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground/70">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-2">
              {w}
            </div>
          ))}
        </div>
        <div className="grid flex-1 auto-rows-fr grid-cols-7 overflow-auto">
          {weeks.flat().map((day) => {
            const key = dayKey(day);
            const inMonth = isSameMonth(day, cursor);
            const isToday = key === todayKey;
            const dayTasks = byDay[key] ?? [];
            return (
              <div
                key={key}
                className={cn(
                  "flex min-h-[92px] flex-col gap-1 border-b border-r border-border/60 p-1.5",
                  !inMonth && "bg-card/30",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center self-start rounded-full text-[12px]",
                    isToday && "bg-primary font-medium text-primary-foreground",
                    !isToday && (inMonth ? "text-muted-foreground" : "text-muted-foreground/40"),
                  )}
                >
                  {day.getDate()}
                </span>
                {dayTasks.slice(0, 3).map((t) => {
                  const done = t.status === "DONE";
                  const overdue = !done && t.dueDate != null && new Date(t.dueDate).getTime() < now;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onOpenTask(t.id)}
                      title={t.title}
                      className={cn(
                        "truncate rounded-md border border-border bg-card px-1.5 py-1 text-left text-[11.5px] text-foreground transition-colors hover:border-muted-foreground/40",
                        overdue && "border-l-[3px] border-l-amber",
                        done && "text-muted-foreground line-through",
                      )}
                    >
                      {t.title}
                    </button>
                  );
                })}
                {dayTasks.length > 3 && (
                  <span className="px-1 text-[11px] text-muted-foreground/60">+{dayTasks.length - 3} mais</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== Mobile: agenda (lista por dia). Uma única landmark <section>; cada dia é um <div>
             apoiado no seu <h3> (evita 30+ regions no leitor de tela). [impeccable a11y] ===== */}
      <section
        ref={agendaRef}
        aria-label="Agenda de tarefas"
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:hidden"
      >
        {agenda.length === 0 && noDue.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
            <p className="text-[13px] text-muted-foreground">Nenhuma tarefa com prazo em {title}.</p>
            {!cursorIsCurrentMonth && (
              <button
                type="button"
                onClick={() => setCursor(firstOfThisMonth())}
                className="text-[12px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Voltar para o mês atual
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {agenda.length === 0 ? (
              <div className="flex flex-col items-start gap-1">
                <p className="text-[13px] text-muted-foreground">Nenhuma tarefa com prazo em {title}.</p>
                {!cursorIsCurrentMonth && (
                  <button
                    type="button"
                    onClick={() => setCursor(firstOfThisMonth())}
                    className="text-[12px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Voltar para o mês atual
                  </button>
                )}
              </div>
            ) : (
              agenda.map(({ key, date, tasks: dayTasks }) => {
                const isToday = key === todayKey;
                const count = `${dayTasks.length} tarefa${dayTasks.length > 1 ? "s" : ""}`;
                return (
                  <div key={key}>
                    <h3 data-today={isToday || undefined} className="flex items-baseline gap-2">
                      <span
                        className={cn(
                          "grid size-8 place-items-center text-[20px] font-semibold tabular-nums",
                          isToday && "rounded-full bg-primary text-[16px] text-primary-foreground",
                          !isToday && "text-foreground",
                        )}
                        aria-hidden
                      >
                        {date.getDate()}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] uppercase tracking-wide",
                          isToday ? "font-medium text-foreground" : "text-muted-foreground",
                        )}
                        aria-hidden
                      >
                        {isToday ? "Hoje" : weekdayFmt.format(date).replace(".", "")}
                      </span>
                      <span className="sr-only">
                        {isToday ? "Hoje, " : ""}
                        {dayLongFmt.format(date)}, {count}
                      </span>
                    </h3>
                    <ul className="mt-2.5 flex flex-col gap-2.5">
                      {dayTasks.map((t) => (
                        <li key={t.id}>
                          <TaskCard task={t} onOpen={() => onOpenTask(t.id)} membersById={membersById} asButton />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}

            {/* Sem prazo — independente do mês; evita a percepção de "sumiu tudo". [jornada] */}
            {noDue.length > 0 && (
              <div>
                <h3 className="flex items-baseline gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Sem prazo
                  <span className="text-muted-foreground/70">({noDue.length})</span>
                </h3>
                <ul className="mt-2.5 flex flex-col gap-2.5">
                  {noDue.map((t) => (
                    <li key={t.id}>
                      <TaskCard task={t} onOpen={() => onOpenTask(t.id)} membersById={membersById} asButton />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
