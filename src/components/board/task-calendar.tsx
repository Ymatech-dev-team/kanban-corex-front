"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Task } from "@/lib/types";
import { buildMonthMatrix, dayKey, groupTasksByDay } from "@/lib/calendar";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

function isSameMonth(d: Date, cursor: Date) {
  return d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear();
}

export function TaskCalendar({ tasks, onOpenTask }: { tasks: Task[]; onOpenTask: (id: string) => void }) {
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const weeks = useMemo(() => buildMonthMatrix(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const byDay = useMemo(() => groupTasksByDay(tasks), [tasks]);
  const todayKey = dayKey(new Date());
  const now = Date.now();

  const title = monthFmt.format(cursor);

  return (
    <div className="flex flex-1 flex-col overflow-hidden p-6">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-[15px] font-medium capitalize tracking-tight">{title}</h2>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            const n = new Date();
            setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
          }}
          className="rounded-md border border-border bg-card px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Hoje
        </button>
      </div>

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
  );
}
