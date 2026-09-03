"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ChevronRight } from "lucide-react";
import { useMyTasks } from "@/lib/hooks/use-my-tasks";
import { useBoardNav } from "@/lib/board-nav";
import { dueState } from "@/lib/due";
import { notifKey, markSeen, useSeenNotifications } from "@/lib/notifications-store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const SESSION_KEY = "sdt_due_reminder_shown";

function alreadyShown(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}
function markShown() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* sessionStorage indisponível — mostra uma vez por carga, sem persistir */
  }
}

/** Pop-up único por sessão, ao abrir o site, com as tarefas vencendo/vencidas. */
export function DueReminder() {
  const router = useRouter();
  const nav = useBoardNav();
  const mine = useMyTasks();
  const seen = useSeenNotifications();
  const [open, setOpen] = useState(false);
  const decided = useRef(false);

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

  useEffect(() => {
    if (decided.current || !mine.isSuccess) return;
    decided.current = true;
    if (items.length > 0 && !alreadyShown()) {
      setOpen(true);
      markShown();
    }
    // items é derivado de mine.data; basta reagir ao sucesso do fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine.isSuccess]);

  const overdue = items.filter((x) => x.due.state === "overdue").length;
  const soon = items.length - overdue;

  function openTask(projectId: string, taskId: string, key: string) {
    markSeen([key]);
    setOpen(false);
    nav.request(projectId, taskId);
    router.push("/clientes");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-full border border-amber/40 bg-amber/5 text-amber">
            <CalendarClock className="size-5" />
          </div>
          <DialogTitle>Atenção aos prazos</DialogTitle>
          <DialogDescription>
            {overdue > 0 && `${overdue} vencida${overdue > 1 ? "s" : ""}`}
            {overdue > 0 && soon > 0 && " · "}
            {soon > 0 && `${soon} vencendo`}.
          </DialogDescription>
        </DialogHeader>

        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {items.map(({ task, due, key }) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => openTask(task.projectId, task.id, key)}
                className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:border-muted-foreground/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-[13px]">{task.title}</span>
                  <span className="text-[11.5px] text-amber">{due.label}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>

        <div className="flex justify-end pt-1">
          <Button type="button" onClick={() => setOpen(false)}>
            Entendi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
